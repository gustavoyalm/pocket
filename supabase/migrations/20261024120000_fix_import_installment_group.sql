-- Correção do agrupamento de parcelas importadas.
-- O "data_compra" do Open Finance não é consistente entre lojas:
--   • às vezes é a data ORIGINAL da compra em todas as parcelas (ex.: Havan: 13/09 em todas)
--   • às vezes é a data DAQUELA parcela, colada no lançamento (ex.: Mercado Livre 5/5: 15/01, lançada 16/01)
-- Regra: da 2ª parcela em diante, se data_compra estiver a até 5 dias do lançamento, ela é a data
-- da parcela e a original = data_compra − (nº − 1) meses; senão, data_compra já é a original.

create or replace function public.approve_import_items(p_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i public.import_items;
  tx uuid;
  approved int := 0;
  clean_desc text;
  original_purchase date;
begin
  for i in
    select * from public.import_items
    where id = any (p_ids) and status = 'pending' and account_id is not null and category_id is not null
    order by date
  loop
    -- "Shein *Shein.Com 12/12" → "Shein *Shein.Com" (a parcela fica nos campos próprios)
    clean_desc := btrim(regexp_replace(i.description, '\s*\d+\s*/\s*\d+\s*$', ''));
    original_purchase := case
      when i.installment_number > 1 and i.purchase_date is not null and abs(i.date - i.purchase_date) <= 5
        then (i.purchase_date - make_interval(months => i.installment_number - 1))::date
      else coalesce(i.purchase_date, i.date)
    end;

    insert into public.transactions (
      account_id, category_id, type, amount, date, description, invoice_month,
      installment_group, installment_number, installment_total
    ) values (
      i.account_id, i.category_id, i.type, i.amount, i.date, nullif(clean_desc, ''), i.invoice_month,
      -- parcelas da mesma compra ficam no mesmo grupo: mesmo cartão, MÊS da compra original
      -- (o dia pode variar entre parcelas em meses curtos), descrição e nº de parcelas
      case when i.installment_total is not null then
        extensions.uuid_generate_v5(
          extensions.uuid_ns_oid(),
          concat_ws('|', i.user_id, i.account_id, to_char(original_purchase, 'YYYY-MM'), lower(clean_desc), i.installment_total)
        )
      end,
      i.installment_number,
      i.installment_total
    )
    returning id into tx;

    update public.import_items
    set status = 'approved', transaction_id = tx, decided_at = now()
    where id = i.id;

    -- Aprende a categoria para as próximas importações
    if i.bank_category is not null then
      insert into public.import_category_rules (source, bank_category, category_id)
      values (i.source, i.bank_category, i.category_id)
      on conflict (user_id, source, lower(bank_category))
      do update set category_id = excluded.category_id, updated_at = now();
    end if;

    approved := approved + 1;
  end loop;

  return approved;
end;
$$;
