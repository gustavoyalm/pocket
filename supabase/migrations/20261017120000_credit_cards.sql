-- Cartão de crédito: fechamento/vencimento, faturas, parcelamento e transferências entre contas.
--
-- Regras de fatura (fatura = mês do VENCIMENTO, ex.: "fatura de novembro" vence em novembro):
--   • compra ANTES do dia de fechamento → fecha no mês da compra; no dia do fechamento ou depois → mês seguinte
--   • vencimento depois do fechamento no mesmo mês se due_day > closing_day; senão no mês seguinte
--   • dias maiores que o mês (ex.: 31 em fevereiro) usam o último dia do mês
-- A fatura fica gravada na transação (invoice_month) e pode ser trocada manualmente.

-- ─── Contas: campos de cartão ────────────────────────────────────────
alter table public.accounts
  add column closing_day  smallint check (closing_day between 1 and 31),
  add column due_day      smallint check (due_day between 1 and 31),
  add column credit_limit numeric(14, 2) check (credit_limit >= 0),
  add constraint accounts_card_days check (
    (type = 'credit_card') = (closing_day is not null and due_day is not null)
  ),
  add constraint accounts_card_limit check (credit_limit is null or type = 'credit_card');

-- ─── Transações: fatura, mês de exibição e parcelas ──────────────────
alter table public.transactions
  add column invoice_month date check (extract(day from invoice_month) = 1),
  add column installment_group  uuid,
  add column installment_number smallint,
  add column installment_total  smallint,
  add constraint transactions_installments check (
    (installment_group is null and installment_number is null and installment_total is null)
    or (installment_group is not null
        and installment_total between 2 and 72
        and installment_number between 1 and installment_total)
  ),
  -- Mês em que a transação aparece: o da fatura (cartão) ou o da data (demais contas)
  add column period date generated always as (
    coalesce(invoice_month, date_trunc('month', date::timestamp)::date)
  ) stored;

create index transactions_user_period_idx on public.transactions (user_id, period);
create index transactions_installment_group_idx on public.transactions (installment_group)
  where installment_group is not null;

-- Calcula a fatura de compras no cartão (lógica inline: o trigger roda como o usuário,
-- que não tem acesso a funções auxiliares do schema "private")
create function private.set_transaction_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acc record;
  m date;
  closing date;
begin
  select type, closing_day, due_day into acc from public.accounts where id = new.account_id;

  if acc.type is distinct from 'credit_card' then
    new.invoice_month := null;
    return new;
  end if;

  if new.invoice_month is not null then
    new.invoice_month := date_trunc('month', new.invoice_month::timestamp)::date;
    return new;
  end if;

  m := date_trunc('month', new.date::timestamp)::date;
  closing := m + (least(acc.closing_day,
    extract(day from (m + interval '1 month - 1 day'))::int) - 1);
  if new.date >= closing then
    m := (m + interval '1 month')::date;
  end if;
  if acc.due_day <= acc.closing_day then
    m := (m + interval '1 month')::date;
  end if;
  new.invoice_month := m;
  return new;
end;
$$;

create trigger transactions_set_invoice
  before insert or update of account_id, date, invoice_month on public.transactions
  for each row execute function private.set_transaction_invoice();

-- ─── Transferências ──────────────────────────────────────────────────
create table public.transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_account_id uuid not null,
  to_account_id   uuid not null,
  amount          numeric(14, 2) not null check (amount > 0),
  date            date not null default current_date,
  description     text check (char_length(description) <= 200),
  -- Quando o destino é um cartão: qual fatura este pagamento quita
  invoice_month   date check (extract(day from invoice_month) = 1),
  created_at      timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

create index transfers_user_date_idx on public.transfers (user_id, date desc);
create index transfers_from_idx on public.transfers (from_account_id, user_id);
create index transfers_to_idx on public.transfers (to_account_id, user_id);

alter table public.transfers enable row level security;

create policy "own transfers" on public.transfers
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.transfers from anon;

-- Pagamento de cartão sem fatura informada → fatura que fechou mais recentemente
create function private.set_transfer_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acc record;
  m date;
  closing date;
begin
  select type, closing_day, due_day into acc from public.accounts where id = new.to_account_id;

  if acc.type is distinct from 'credit_card' then
    new.invoice_month := null;
    return new;
  end if;

  if new.invoice_month is not null then
    new.invoice_month := date_trunc('month', new.invoice_month::timestamp)::date;
    return new;
  end if;

  -- mesmo cálculo de uma compra nessa data, voltando um mês (a fatura aberta ainda não fechou)
  m := date_trunc('month', new.date::timestamp)::date;
  closing := m + (least(acc.closing_day,
    extract(day from (m + interval '1 month - 1 day'))::int) - 1);
  if new.date >= closing then
    m := (m + interval '1 month')::date;
  end if;
  if acc.due_day <= acc.closing_day then
    m := (m + interval '1 month')::date;
  end if;
  new.invoice_month := (m - interval '1 month')::date;
  return new;
end;
$$;

create trigger transfers_set_invoice
  before insert or update of to_account_id, date, invoice_month on public.transfers
  for each row execute function private.set_transfer_invoice();

-- Não deixa virar/deixar de ser cartão uma conta que já tem movimentação
create function private.check_account_type_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.type = 'credit_card') <> (new.type = 'credit_card') and (
    exists (select 1 from public.transactions where account_id = new.id)
    or exists (select 1 from public.transfers where from_account_id = new.id or to_account_id = new.id)
  ) then
    raise exception 'Não é possível transformar em (ou deixar de ser) cartão uma conta com movimentações.';
  end if;
  return new;
end;
$$;

create trigger accounts_check_type_change
  before update of type on public.accounts
  for each row execute function private.check_account_type_change();

-- ─── Saldos considerando transferências ──────────────────────────────
create or replace view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  a.initial_balance
    + coalesce((select sum(case when t.type = 'income' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id), 0)
    + coalesce((select sum(amount) from public.transfers tr where tr.to_account_id = a.id), 0)
    - coalesce((select sum(amount) from public.transfers tr where tr.from_account_id = a.id), 0)
    as balance
from public.accounts a;

-- ─── Faturas ─────────────────────────────────────────────────────────
create view public.card_invoices
with (security_invoker = true)
as
with charges as (
  select account_id, invoice_month,
         sum(case when type = 'expense' then amount else -amount end) as total,
         count(*)::int as transaction_count
  from public.transactions
  where invoice_month is not null
  group by 1, 2
),
payments as (
  select to_account_id as account_id, invoice_month, sum(amount) as paid
  from public.transfers
  where invoice_month is not null
  group by 1, 2
),
months as (
  select account_id, invoice_month from charges
  union
  select account_id, invoice_month from payments
)
select
  a.id as account_id,
  a.user_id,
  m.invoice_month,
  (cm.closing_month + (least(a.closing_day,
     extract(day from (cm.closing_month + interval '1 month - 1 day'))::int) - 1)) as closing_date,
  (m.invoice_month + (least(a.due_day,
     extract(day from (m.invoice_month + interval '1 month - 1 day'))::int) - 1)) as due_date,
  coalesce(c.total, 0) as total,
  coalesce(p.paid, 0) as paid,
  coalesce(c.transaction_count, 0) as transaction_count
from months m
join public.accounts a on a.id = m.account_id
left join charges c on c.account_id = m.account_id and c.invoice_month = m.invoice_month
left join payments p on p.account_id = m.account_id and p.invoice_month = m.invoice_month
cross join lateral (
  select case when a.due_day > a.closing_day then m.invoice_month
              else (m.invoice_month - interval '1 month')::date end as closing_month
) cm;

revoke all on public.card_invoices from anon;

-- ─── Compra parcelada ────────────────────────────────────────────────
-- Cria uma transação por parcela, em faturas consecutivas. Centavos que sobram vão para a 1ª.
-- security invoker: roda com as permissões (e o RLS) de quem chama.
create function public.create_installment_purchase(
  p_account_id    uuid,
  p_category_id   uuid,
  p_amount        numeric,
  p_installments  int,
  p_date          date,
  p_description   text default null,
  p_tags          text[] default '{}',
  p_notes         text default null,
  p_first_invoice date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  grp uuid := gen_random_uuid();
  per numeric(14, 2);
  first_invoice date;
begin
  if p_installments not between 2 and 72 then
    raise exception 'O número de parcelas deve ficar entre 2 e 72.';
  end if;
  if (select type from public.accounts where id = p_account_id) is distinct from 'credit_card' then
    raise exception 'Parcelamento só é possível em cartão de crédito.';
  end if;
  per := trunc(p_amount / p_installments, 2);
  if per <= 0 then
    raise exception 'Valor muito baixo para % parcelas.', p_installments;
  end if;

  insert into public.transactions (
    account_id, category_id, type, amount, date, description, tags, notes, invoice_month,
    installment_group, installment_number, installment_total
  ) values (
    p_account_id, p_category_id, 'expense', p_amount - per * (p_installments - 1), p_date,
    p_description, p_tags, p_notes, p_first_invoice, grp, 1, p_installments
  )
  returning invoice_month into first_invoice;

  insert into public.transactions (
    account_id, category_id, type, amount, date, description, tags, notes, invoice_month,
    installment_group, installment_number, installment_total
  )
  select p_account_id, p_category_id, 'expense', per, p_date, p_description, p_tags, p_notes,
         (first_invoice + make_interval(months => n - 1))::date, grp, n, p_installments
  from generate_series(2, p_installments) as n;

  return grp;
end;
$$;

revoke execute on function public.create_installment_purchase from public, anon;
grant execute on function public.create_installment_purchase to authenticated;
