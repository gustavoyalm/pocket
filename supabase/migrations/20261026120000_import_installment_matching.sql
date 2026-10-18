-- Agrupamento de parcelas importadas: em vez de uma chave fixa (que juntava compras diferentes
-- na mesma loja), cada parcela procura a compra a que pertence entre as já aprovadas:
--   • mesmo cartão, mesma descrição, mesma data de compra e mesmo nº de parcelas
--   • valor da parcela igual, com tolerância de 1 centavo por parcela (a 1ª costuma vir com
--     alguns centavos a mais por arredondamento: 44,31 + 9 × 44,29)
--   • a compra ainda não pode ter esse número de parcela (se já tem um "3/5", é outra compra)
-- Sem compra compatível, começa um grupo novo.

create or replace function public.approve_import_items(p_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i public.import_items;
  tx uuid;
  grp uuid;
  approved int := 0;
  clean_desc text;
begin
  for i in
    select * from public.import_items
    where id = any (p_ids) and status = 'pending' and account_id is not null and category_id is not null
    -- parcelas de uma mesma compra em sequência (a 1ª define o grupo para as seguintes)
    order by coalesce(purchase_date, date), description, installment_number nulls first
  loop
    -- "Shein *Shein.Com 12/12" → "Shein *Shein.Com" (a parcela fica nos campos próprios)
    clean_desc := btrim(regexp_replace(i.description, '\s*\d+\s*/\s*\d+\s*$', ''));
    grp := null;

    if i.installment_total is not null then
      select t.installment_group into grp
      from public.import_items o
      join public.transactions t on t.id = o.transaction_id
      where o.status = 'approved'
        and o.account_id = i.account_id
        and o.installment_total = i.installment_total
        and o.purchase_date is not distinct from i.purchase_date
        and lower(btrim(regexp_replace(o.description, '\s*\d+\s*/\s*\d+\s*$', ''))) = lower(clean_desc)
        and abs(o.amount - i.amount) <= 0.01 * i.installment_total
        and t.installment_group is not null
        and not exists (
          select 1 from public.transactions s
          where s.installment_group = t.installment_group and s.installment_number = i.installment_number
        )
      order by abs(o.amount - i.amount), o.decided_at
      limit 1;

      grp := coalesce(grp, gen_random_uuid());
    end if;

    insert into public.transactions (
      account_id, category_id, type, amount, date, description, invoice_month,
      installment_group, installment_number, installment_total
    ) values (
      i.account_id, i.category_id, i.type, i.amount, i.date, nullif(clean_desc, ''),
      null, -- fatura calculada pelo cartão (trigger)
      grp, i.installment_number, i.installment_total
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
