-- Evolução mensal com duas visões:
--   'purchase' (padrão): pela data da transação — "quanto gastei em cada mês"
--   'cash': pela saída do caixa — compras no cartão contam no mês da fatura (vencimento)
-- Em 'cash' com "só pagos", uma compra no cartão só conta se a fatura dela já estiver paga.

drop function public.report_monthly(date, date, boolean, uuid, uuid);

create function public.report_monthly(
  p_start      date,
  p_end        date,
  p_paid_only  boolean default false,
  p_account_id uuid default null,
  p_tag_id     uuid default null,
  p_basis      text default 'purchase'
)
returns table (month date, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      t.type,
      t.amount,
      case when p_basis = 'cash' and t.invoice_month is not null
           then t.invoice_month
           else date_trunc('month', t.date::timestamp)::date end as month,
      case when p_basis = 'cash' and t.invoice_month is not null
           then coalesce((
             select ci.paid >= ci.total from public.card_invoices ci
             where ci.account_id = t.account_id and ci.invoice_month = t.invoice_month
           ), false)
           else t.paid end as settled
    from public.transactions t
    -- Pré-filtro pela data (usa índice): a fatura fica no máximo a poucos meses da compra
    where t.date >= (p_start - interval '3 months')::date
      and t.date < (p_end + interval '3 months')::date
      and (p_account_id is null or t.account_id = p_account_id)
      and (p_tag_id is null or exists (
        select 1 from public.transaction_tags tt where tt.transaction_id = t.id and tt.tag_id = p_tag_id
      ))
  )
  select month,
         coalesce(sum(amount) filter (where type = 'income'), 0),
         coalesce(sum(amount) filter (where type = 'expense'), 0)
  from base
  where month >= p_start and month < p_end
    and (not p_paid_only or settled)
  group by month
  order by month;
$$;

revoke execute on function public.report_monthly from public, anon;
grant execute on function public.report_monthly to authenticated;
