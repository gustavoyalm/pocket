-- Controle de pago / pendente.
--   • Transações no cartão nascem pagas (quem é "paga" de fato é a fatura).
--   • Nas demais contas, transações e transferências nascem pendentes.
--   • Saldo atual = só o que foi pago; saldo previsto = inclui os pendentes.

-- ─── Transações ──────────────────────────────────────────────────────
alter table public.transactions add column paid boolean;
update public.transactions set paid = true; -- o que já existia aconteceu de fato
alter table public.transactions alter column paid set not null;

-- Sem valor informado: paga se for cartão, pendente nas demais contas.
-- (o NOT NULL é verificado depois dos triggers BEFORE)
create function private.set_transaction_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paid is null then
    new.paid := coalesce(
      (select type = 'credit_card' from public.accounts where id = new.account_id),
      false
    );
  end if;
  return new;
end;
$$;

create trigger transactions_set_paid
  before insert on public.transactions
  for each row execute function private.set_transaction_paid();

create index transactions_pending_idx on public.transactions (user_id, date) where not paid;

-- ─── Transferências ──────────────────────────────────────────────────
alter table public.transfers add column paid boolean not null default false;
update public.transfers set paid = true;

-- ─── Saldos: atual (pago) e previsto (tudo) ──────────────────────────
drop view public.account_balances;

create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  a.initial_balance
    + coalesce((select sum(case when t.type = 'income' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id and t.paid), 0)
    + coalesce((select sum(amount) from public.transfers tr where tr.to_account_id = a.id and tr.paid), 0)
    - coalesce((select sum(amount) from public.transfers tr where tr.from_account_id = a.id and tr.paid), 0)
    as balance,
  a.initial_balance
    + coalesce((select sum(case when t.type = 'income' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id), 0)
    + coalesce((select sum(amount) from public.transfers tr where tr.to_account_id = a.id), 0)
    - coalesce((select sum(amount) from public.transfers tr where tr.from_account_id = a.id), 0)
    as projected_balance
from public.accounts a;

revoke all on public.account_balances from anon;

-- ─── Faturas: pago (efetivado) e agendado (pagamento pendente) ───────
drop view public.card_invoices;

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
  select to_account_id as account_id, invoice_month,
         coalesce(sum(amount) filter (where paid), 0) as paid,
         coalesce(sum(amount) filter (where not paid), 0) as scheduled
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
  coalesce(p.scheduled, 0) as scheduled,
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
