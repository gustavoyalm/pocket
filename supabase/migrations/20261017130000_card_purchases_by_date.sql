-- Compras no cartão passam a aparecer na DATA da compra (não mais no mês da fatura).
-- A fatura continua em invoice_month e é usada só na tela de faturas.
-- Parcelas ganham datas mensais (1ª na data da compra, 2ª um mês depois...) para que
-- cada mês mostre só a sua parcela.

-- ─── Sem "period": a listagem volta a ser pela data ──────────────────
drop index public.transactions_user_period_idx;
alter table public.transactions drop column period;

-- ─── Parcelas existentes: datas mensais ──────────────────────────────
-- (o trigger de fatura mantém invoice_month, pois ele já está preenchido)
update public.transactions
set date = (date + make_interval(months => installment_number - 1))::date
where installment_group is not null
  and installment_number > 1
  and date = (select min(t.date) from public.transactions t where t.installment_group = transactions.installment_group);

-- ─── Compra parcelada com datas mensais ──────────────────────────────
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
    account_id, category_id, type, amount, date, description, tags, notes, invoice_month,
    installment_group, installment_number, installment_total
  ) values (
    p_account_id, p_category_id, 'expense', p_amount - per * (p_installments - 1), p_date,
    p_description, p_tags, p_notes, p_first_invoice, grp, 1, p_installments
  )
  returning invoice_month into first_invoice;

  -- Demais: um mês depois a cada parcela, cada uma na fatura seguinte
  insert into public.transactions (
    account_id, category_id, type, amount, date, description, tags, notes, invoice_month,
    installment_group, installment_number, installment_total
  )
  select p_account_id, p_category_id, 'expense', per,
         (p_date + make_interval(months => n - 1))::date,
         p_description, p_tags, p_notes,
         (first_invoice + make_interval(months => n - 1))::date, grp, n, p_installments
  from generate_series(2, p_installments) as n;

  return grp;
end;
$$;
