-- Importação passa a usar só a DATA DA COMPRA:
--   • purchase_date = data original da compra (regra abaixo)
--   • date = data da parcela = compra + (nº − 1) meses (mesma convenção das parcelas lançadas à mão)
--   • a fatura é calculada pelo pocket, pelo fechamento/vencimento do cartão identificado
--     (a "fatura" enviada pelo banco é ignorada; fica só no raw)
--   • pagamentos de fatura (operacao = PAGAMENTO_FATURA) são ignorados na chegada
--
-- Data original da compra: o "data_compra" do banco não é consistente entre lojas — às vezes é a data
-- original em todas as parcelas, às vezes é a data da própria parcela (colada no "data" do lançamento).
-- Da 2ª parcela em diante, se data_compra estiver a até 5 dias do "data", ela é a data da parcela e a
-- original = data_compra − (nº − 1) meses; senão, data_compra já é a original.

create or replace function public.ingest_import_items(p_token text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  items jsonb := case when jsonb_typeof(p_items) = 'array' then p_items else jsonb_build_array(p_items) end;
  item jsonb;
  inserted int := 0;
  duplicates int := 0;
  skipped int := 0;
  payments int := 0;
  errors jsonb := '[]';
  parcel text[];
  n int;
  card_final_v text;
  bank_cat text;
  n_rows int;
  v_account uuid;
  v_since date;
  v_closing int;
  v_due int;
  v_bank_date date;
  v_bank_purchase date;
  v_original date;
  v_date date;
  v_month date;
  v_invoice date;
begin
  select user_id into uid
  from public.import_tokens
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null;
  if uid is null then
    raise exception 'Token de importação inválido ou revogado.' using errcode = '28000';
  end if;
  if jsonb_array_length(items) > 1000 then
    raise exception 'Máximo de 1000 itens por envio.';
  end if;

  update public.import_tokens set last_used_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  for item in select * from jsonb_array_elements(items) loop
    begin
      -- Pagamento de fatura não é transação (no pocket ele é uma transferência)
      if upper(coalesce(item->>'operacao', '')) = 'PAGAMENTO_FATURA' then
        payments := payments + 1;
        continue;
      end if;

      parcel := regexp_match(coalesce(item->>'parcela', ''), '^\s*(\d+)\s*/\s*(\d+)\s*$');
      n := case when parcel is not null and parcel[2]::int > 1 then parcel[1]::int else 1 end;
      card_final_v := nullif(regexp_replace(coalesce(item->>'cartao_final', ''), '\D', '', 'g'), '');
      bank_cat := nullif(btrim(item->>'categoria'), '');
      v_bank_date := (item->>'data')::date;
      v_bank_purchase := (item->>'data_compra')::date;

      -- Data original da compra e data desta parcela
      v_original := case
        when n > 1 and v_bank_purchase is not null and v_bank_date is not null and abs(v_bank_date - v_bank_purchase) <= 5
          then (v_bank_purchase - make_interval(months => n - 1))::date
        else coalesce(v_bank_purchase, v_bank_date)
      end;
      v_date := (v_original + make_interval(months => n - 1))::date;

      -- Cartão pelo final
      v_account := null;
      v_since := null;
      select a.id, a.import_since, a.closing_day, a.due_day into v_account, v_since, v_closing, v_due
      from public.accounts a
      where a.user_id = uid and a.type = 'credit_card' and card_final_v = any (a.card_finals)
      limit 1;

      -- Fatura pelo cartão (mesma regra do trigger de transações); sem cartão: mês da parcela
      v_month := date_trunc('month', v_date::timestamp)::date;
      if v_account is not null then
        if v_date >= v_month + (least(v_closing, extract(day from (v_month + interval '1 month - 1 day'))::int) - 1) then
          v_month := (v_month + interval '1 month')::date;
        end if;
        if v_due <= v_closing then
          v_month := (v_month + interval '1 month')::date;
        end if;
        v_invoice := v_month;
      else
        v_invoice := null;
      end if;

      -- Corte: fatura anterior ao início da importação → descarta
      if coalesce(v_invoice, v_month) < coalesce(v_since, date_trunc('month', current_date::timestamp)::date) then
        skipped := skipped + 1;
        continue;
      end if;

      insert into public.import_items (
        user_id, external_id, card_final, description, amount, type, date, purchase_date, invoice_month,
        installment_number, installment_total, bank_category, bank_status, operation, raw,
        account_id, category_id
      ) values (
        uid,
        item->>'id',
        card_final_v,
        btrim(item->>'descricao'),
        abs((item->>'valor')::numeric),
        case when lower(item->>'tipo') in ('receita', 'credito', 'crédito', 'estorno') then 'income' else 'expense' end::public.transaction_type,
        v_date,
        v_original,
        v_invoice,
        case when n > 1 or (parcel is not null and parcel[2]::int > 1) then n::smallint end,
        case when parcel is not null and parcel[2]::int > 1 then parcel[2]::smallint end,
        bank_cat,
        item->>'status',
        item->>'operacao',
        item,
        v_account,
        -- categoria pela regra aprendida
        (select r.category_id from public.import_category_rules r
          where r.user_id = uid and r.source = 'open_finance' and lower(r.bank_category) = lower(bank_cat))
      )
      on conflict (user_id, source, external_id) do nothing;

      get diagnostics n_rows = row_count;
      if n_rows = 1 then inserted := inserted + 1; else duplicates := duplicates + 1; end if;
    exception when others then
      errors := errors || jsonb_build_object('id', item->>'id', 'erro', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'recebidos', jsonb_array_length(items),
    'novos', inserted,
    'repetidos', duplicates,
    'ignorados_antes_do_inicio', skipped,
    'ignorados_pagamento_fatura', payments,
    'erros', errors
  );
end;
$$;

-- Aprovação: data da parcela e fatura calculada pelo cartão escolhido (trigger de transações)
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
  purchase date;
begin
  for i in
    select * from public.import_items
    where id = any (p_ids) and status = 'pending' and account_id is not null and category_id is not null
    order by date
  loop
    -- "Shein *Shein.Com 12/12" → "Shein *Shein.Com" (a parcela fica nos campos próprios)
    clean_desc := btrim(regexp_replace(i.description, '\s*\d+\s*/\s*\d+\s*$', ''));
    purchase := coalesce(i.purchase_date, i.date);

    insert into public.transactions (
      account_id, category_id, type, amount, date, description, invoice_month,
      installment_group, installment_number, installment_total
    ) values (
      i.account_id, i.category_id, i.type, i.amount, i.date, nullif(clean_desc, ''),
      null, -- fatura calculada pelo cartão (trigger)
      -- parcelas da mesma compra no mesmo grupo: cartão, data da compra, descrição e nº de parcelas.
      -- Dias 29–31 contam como 28 (o ajuste de mês curto não separa parcelas da mesma compra).
      case when i.installment_total is not null then
        extensions.uuid_generate_v5(
          extensions.uuid_ns_oid(),
          concat_ws('|', i.user_id, i.account_id,
            to_char(purchase, 'YYYY-MM-') || lpad(least(extract(day from purchase)::int, 28)::text, 2, '0'),
            lower(clean_desc), i.installment_total)
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

-- Converte os itens pendentes que já estavam na caixa para a regra nova
update public.import_items i
set purchase_date = x.original,
    date = (x.original + make_interval(months => coalesce(i.installment_number, 1) - 1))::date,
    invoice_month = null
from (
  select id,
    case
      when installment_number > 1 and (raw->>'data_compra') is not null and (raw->>'data') is not null
           and abs((raw->>'data')::date - (raw->>'data_compra')::date) <= 5
        then ((raw->>'data_compra')::date - make_interval(months => installment_number - 1))::date
      else coalesce((raw->>'data_compra')::date, (raw->>'data')::date)
    end as original
  from public.import_items
  where status = 'pending'
) x
where i.id = x.id;
