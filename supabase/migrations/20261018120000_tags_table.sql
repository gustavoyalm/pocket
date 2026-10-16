-- Tags viram uma tabela própria (com cor) ligada às transações por uma tabela de ligação.
-- Substitui a coluna transactions.tags (text[]) e a view transaction_tags.

-- ─── Tags ────────────────────────────────────────────────────────────
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  color      text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- "Viagem" e "viagem" são a mesma tag
create unique index tags_user_name_key on public.tags (user_id, lower(name));

alter table public.tags enable row level security;

create policy "own tags" on public.tags
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.tags from anon;

-- ─── Ligação transação ↔ tag ─────────────────────────────────────────
drop view public.transaction_tags;

alter table public.transactions add constraint transactions_id_user_id_key unique (id, user_id);

create table public.transaction_tags (
  transaction_id uuid not null,
  tag_id         uuid not null,
  user_id        uuid not null default auth.uid(),
  primary key (transaction_id, tag_id),
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create index transaction_tags_transaction_idx on public.transaction_tags (transaction_id, user_id);
create index transaction_tags_tag_idx on public.transaction_tags (tag_id, user_id);

alter table public.transaction_tags enable row level security;

create policy "own transaction tags" on public.transaction_tags
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.transaction_tags from anon;

-- ─── Migra as tags existentes ────────────────────────────────────────
with distinct_tags as (
  select distinct t.user_id, tag
  from public.transactions t, unnest(t.tags) as tag
),
numbered as (
  select user_id, tag, row_number() over (partition by user_id order by tag) as rn
  from distinct_tags
)
insert into public.tags (user_id, name, color)
select user_id, tag,
       (array['#22c55e','#0ea5e9','#6366f1','#8b5cf6','#ec4899','#ef4444',
              '#f97316','#f59e0b','#14b8a6','#64748b','#a1a1aa'])[((rn - 1) % 11) + 1]
from numbered;

insert into public.transaction_tags (transaction_id, tag_id, user_id)
select t.id, g.id, t.user_id
from public.transactions t
cross join lateral unnest(t.tags) as tag
join public.tags g on g.user_id = t.user_id and lower(g.name) = lower(tag);

drop trigger transactions_prepare_tags on public.transactions;
drop function private.prepare_transaction_tags();
drop index public.transactions_tags_idx;
alter table public.transactions drop column tags;

-- ─── Uso de cada tag ─────────────────────────────────────────────────
create view public.tag_usage
with (security_invoker = true)
as
select tag_id, count(*)::int as uses
from public.transaction_tags
group by tag_id;

revoke all on public.tag_usage from anon;

-- ─── Definir as tags de transações pelos nomes ───────────────────────
-- Cria as tags que ainda não existem (com uma cor da paleta) e substitui as tags das transações.
-- security invoker: roda com as permissões (e o RLS) de quem chama.
create function public.set_transaction_tags(p_transaction_ids uuid[], p_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean text[];
  palette text[] := array['#22c55e','#0ea5e9','#6366f1','#8b5cf6','#ec4899','#ef4444',
                          '#f97316','#f59e0b','#14b8a6','#64748b','#a1a1aa'];
begin
  -- Sem espaços extras, sem vazias, sem repetidas (ignorando maiúsculas), na ordem digitada
  select coalesce(array_agg(n order by pos), '{}') into clean
  from (
    select distinct on (lower(n)) n, pos
    from (
      select regexp_replace(btrim(raw), '\s+', ' ', 'g') as n, pos
      from unnest(coalesce(p_names, '{}')) with ordinality as u (raw, pos)
    ) x
    where n <> ''
    order by lower(n), pos
  ) y;

  if cardinality(clean) > 20 then
    raise exception 'Máximo de 20 tags por transação.';
  end if;
  if exists (select 1 from unnest(clean) n where char_length(n) > 40) then
    raise exception 'Cada tag pode ter no máximo 40 caracteres.';
  end if;

  insert into public.tags (name, color)
  select c.n, palette[(((select count(*) from public.tags) + row_number() over (order by c.pos) - 1) % 11) + 1]
  from unnest(clean) with ordinality as c (n, pos)
  where not exists (select 1 from public.tags g where lower(g.name) = lower(c.n))
  on conflict do nothing;

  delete from public.transaction_tags where transaction_id = any (p_transaction_ids);

  insert into public.transaction_tags (transaction_id, tag_id)
  select t.id, g.id
  from unnest(p_transaction_ids) as t (id)
  cross join public.tags g
  where lower(g.name) in (select lower(n) from unnest(clean) n);
end;
$$;

revoke execute on function public.set_transaction_tags from public, anon;
grant execute on function public.set_transaction_tags to authenticated;

-- ─── Compra parcelada: tags aplicadas a todas as parcelas ────────────
create or replace function public.create_installment_purchase(
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

  -- 1ª parcela: data da compra; a fatura é calculada pelo trigger (ou a informada)
  insert into public.transactions (
    account_id, category_id, type, amount, date, description, notes, invoice_month,
    installment_group, installment_number, installment_total
  ) values (
    p_account_id, p_category_id, 'expense', p_amount - per * (p_installments - 1), p_date,
    p_description, p_notes, p_first_invoice, grp, 1, p_installments
  )
  returning invoice_month into first_invoice;

  -- Demais: um mês depois a cada parcela, cada uma na fatura seguinte
  insert into public.transactions (
    account_id, category_id, type, amount, date, description, notes, invoice_month,
    installment_group, installment_number, installment_total
  )
  select p_account_id, p_category_id, 'expense', per,
         (p_date + make_interval(months => n - 1))::date,
         p_description, p_notes,
         (first_invoice + make_interval(months => n - 1))::date, grp, n, p_installments
  from generate_series(2, p_installments) as n;

  if cardinality(p_tags) > 0 then
    perform public.set_transaction_tags(
      array(select id from public.transactions where installment_group = grp),
      p_tags
    );
  end if;

  return grp;
end;
$$;
