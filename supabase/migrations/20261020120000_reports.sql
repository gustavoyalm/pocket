-- Relatórios: agregações feitas no banco (o app não precisa baixar todas as transações).
-- Todas são security invoker: rodam com o RLS de quem chama, então cada um só soma o que é seu.
-- Período: p_start inclusivo, p_end exclusivo (ex.: 2026-01-01 a 2026-04-01 = jan–mar).
-- Transferências não entram (não são receita nem despesa).

-- ─── Por categoria (subcategoria; o app agrupa nas categorias-pai) ───
create function public.report_by_category(
  p_start      date,
  p_end        date,
  p_type       public.transaction_type,
  p_paid_only  boolean default false,
  p_account_id uuid default null,
  p_tag_id     uuid default null
)
returns table (category_id uuid, total numeric, transaction_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.amount), count(*)::int
  from public.transactions t
  where t.date >= p_start and t.date < p_end
    and t.type = p_type
    and (not p_paid_only or t.paid)
    and (p_account_id is null or t.account_id = p_account_id)
    and (p_tag_id is null or exists (
      select 1 from public.transaction_tags tt where tt.transaction_id = t.id and tt.tag_id = p_tag_id
    ))
  group by t.category_id;
$$;

-- ─── Evolução mensal ─────────────────────────────────────────────────
create function public.report_monthly(
  p_start      date,
  p_end        date,
  p_paid_only  boolean default false,
  p_account_id uuid default null,
  p_tag_id     uuid default null
)
returns table (month date, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select date_trunc('month', t.date::timestamp)::date,
         coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)
  from public.transactions t
  where t.date >= p_start and t.date < p_end
    and (not p_paid_only or t.paid)
    and (p_account_id is null or t.account_id = p_account_id)
    and (p_tag_id is null or exists (
      select 1 from public.transaction_tags tt where tt.transaction_id = t.id and tt.tag_id = p_tag_id
    ))
  group by 1
  order by 1;
$$;

-- ─── Por tag (tag_id null = transações sem nenhuma tag) ──────────────
-- Uma transação com duas tags conta nas duas.
create function public.report_by_tag(
  p_start      date,
  p_end        date,
  p_type       public.transaction_type,
  p_paid_only  boolean default false,
  p_account_id uuid default null
)
returns table (tag_id uuid, total numeric, transaction_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select t.id, t.amount
    from public.transactions t
    where t.date >= p_start and t.date < p_end
      and t.type = p_type
      and (not p_paid_only or t.paid)
      and (p_account_id is null or t.account_id = p_account_id)
  )
  select tt.tag_id, sum(b.amount), count(*)::int
  from base b
  join public.transaction_tags tt on tt.transaction_id = b.id
  group by tt.tag_id
  union all
  select null, sum(b.amount), count(*)::int
  from base b
  where not exists (select 1 from public.transaction_tags tt where tt.transaction_id = b.id)
  having count(*) > 0;
$$;

revoke execute on function public.report_by_category, public.report_monthly, public.report_by_tag from public, anon;
grant execute on function public.report_by_category, public.report_monthly, public.report_by_tag to authenticated;
