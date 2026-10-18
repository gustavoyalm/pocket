-- Revisão de importações: complemento da descrição e tags por item.
--   • note: texto do usuário; ao aprovar, descrição = "texto do banco | complemento"
--   • tags: nomes de tags; aplicadas à transação ao aprovar (criadas se não existirem)
--   • parcelas que chegarem depois herdam note/tags de outra parcela da mesma compra (mesma referência)

alter table public.import_items
  add column note text check (char_length(note) <= 200),
  add column tags text[] not null default '{}';

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
  meta jsonb;
  pluggy boolean;
  inserted int := 0;
  duplicates int := 0;
  skipped int := 0;
  payments int := 0;
  errors jsonb := '[]';
  parcel text[];
  n int;
  n_total int;
  card_final_v text;
  operation_v text;
  n_rows int;
  v_account uuid;
  v_since date;
  v_closing int;
  v_due int;
  v_bank_date date;
  v_bank_purchase date;
  v_ref text;
  v_bill text;
  v_original date;
  v_date date;
  v_month date;
  v_invoice date;
  v_note text;
  v_tags text[];
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
      meta := coalesce(item->'creditCardMetadata', '{}');
      pluggy := item ? 'creditCardMetadata' or item ? 'descriptionRaw' or item ? 'operationType';

      operation_v := coalesce(item->>'operationType', item->>'operacao');

      -- Pagamento de fatura não é transação (no pocket ele é uma transferência)
      if upper(coalesce(operation_v, '')) = 'PAGAMENTO_FATURA' then
        payments := payments + 1;
        continue;
      end if;

      if pluggy then
        n_total := nullif(meta->>'totalInstallments', '')::int;
        n := case when n_total > 1 then coalesce(nullif(meta->>'installmentNumber', '')::int, 1) else 1 end;
        if n_total <= 1 then n_total := null; end if;
        card_final_v := nullif(regexp_replace(coalesce(meta->>'cardNumber', ''), '\D', '', 'g'), '');
        v_bank_date := ((item->>'date')::timestamptz at time zone 'America/Sao_Paulo')::date;
        v_bank_purchase := ((meta->>'purchaseDate')::timestamptz at time zone 'America/Sao_Paulo')::date;
        v_ref := nullif(meta->>'purchaseDate', '');
        v_bill := meta->>'billForecastDate';
      else
        parcel := regexp_match(coalesce(item->>'parcela', ''), '^\s*(\d+)\s*/\s*(\d+)\s*$');
        n_total := case when parcel is not null and parcel[2]::int > 1 then parcel[2]::int end;
        n := case when n_total is not null then parcel[1]::int else 1 end;
        card_final_v := nullif(regexp_replace(coalesce(item->>'cartao_final', ''), '\D', '', 'g'), '');
        v_bank_date := (item->>'data')::date;
        v_bank_purchase := (item->>'data_compra')::date;
        -- data e hora exatas da compra (purchaseDate da Pluggy), quando o n8n envia
        v_ref := nullif(item->>'compra_ref', '');
        v_bill := item->>'fatura';
      end if;

      -- Data original da compra (algumas lojas mandam a data da parcela no lugar da compra)
      v_original := case
        when n > 1 and v_bank_purchase is not null and v_bank_date is not null and abs(v_bank_date - v_bank_purchase) <= 5
          then (v_bank_purchase - make_interval(months => n - 1))::date
        else coalesce(v_bank_purchase, v_bank_date)
      end;
      -- Nesse caso o horário da compra também é o da parcela: não serve para identificar a compra
      if v_original is distinct from v_bank_purchase then v_ref := null; end if;
      v_date := (v_original + make_interval(months => n - 1))::date;

      -- Cartão pelo final
      v_account := null;
      v_since := null;
      select a.id, a.import_since, a.closing_day, a.due_day into v_account, v_since, v_closing, v_due
      from public.accounts a
      where a.user_id = uid and a.type = 'credit_card' and card_final_v = any (a.card_finals)
      limit 1;

      -- Fatura: a informada pelo banco; sem ela, calculada pelo cartão (mesma regra do trigger)
      v_month := date_trunc('month', v_date::timestamp)::date;
      if v_bill ~ '^\d{4}-\d{2}$' then
        v_invoice := (v_bill || '-01')::date;
      elsif v_account is not null then
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

      -- Parcelas novas de uma compra já conhecida herdam o complemento e as tags dela
      v_note := null;
      v_tags := '{}';
      if v_ref is not null then
        select o.note, o.tags into v_note, v_tags
        from public.import_items o
        where o.user_id = uid and o.purchase_ref = v_ref and (o.note is not null or cardinality(o.tags) > 0)
        order by o.received_at desc
        limit 1;
        v_tags := coalesce(v_tags, '{}');
      end if;

      insert into public.import_items (
        user_id, external_id, card_final, description, amount, type, date, purchase_date, purchase_ref, invoice_month,
        installment_number, installment_total, bank_status, operation, raw,
        account_id, note, tags
      ) values (
        uid,
        item->>'id',
        card_final_v,
        btrim(coalesce(item->>'description', item->>'descricao')),
        abs(coalesce(item->>'amount', item->>'valor')::numeric),
        case
          when pluggy then case when upper(item->>'type') = 'CREDIT' then 'income' else 'expense' end
          when lower(item->>'tipo') in ('receita', 'credito', 'crédito', 'estorno') then 'income'
          else 'expense'
        end::public.transaction_type,
        v_date,
        v_original,
        v_ref,
        v_invoice,
        case when n_total is not null then n::smallint end,
        n_total::smallint,
        item->>'status',
        operation_v,
        item,
        v_account,
        v_note,
        v_tags
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
    clean_desc := btrim(regexp_replace(i.description, '\s*\d+\s*/\s*\d+\s*$', ''));
    grp := null;

    if i.installment_total is not null then
      select t.installment_group into grp
      from public.import_items o
      join public.transactions t on t.id = o.transaction_id
      where o.status = 'approved'
        and o.account_id = i.account_id
        and o.installment_total = i.installment_total
        and t.installment_group is not null
        and not exists (
          select 1 from public.transactions s
          where s.installment_group = t.installment_group and s.installment_number = i.installment_number
        )
        and (
          -- 1) mesma compra pela referência exata (data e hora da compra)
          (i.purchase_ref is not null and o.purchase_ref = i.purchase_ref)
          -- 2) sem referência: mesma loja, mesma data e valor de parcela compatível
          or (i.purchase_ref is null
              and o.purchase_date is not distinct from i.purchase_date
              and lower(btrim(regexp_replace(o.description, '\s*\d+\s*/\s*\d+\s*$', ''))) = lower(clean_desc)
              and abs(o.amount - i.amount) <= 0.01 * i.installment_total)
        )
      order by (o.purchase_ref is not distinct from i.purchase_ref) desc, abs(o.amount - i.amount), o.decided_at
      limit 1;

      grp := coalesce(grp, gen_random_uuid());
    end if;

    insert into public.transactions (
      account_id, category_id, type, amount, date, description, invoice_month,
      installment_group, installment_number, installment_total
    ) values (
      i.account_id, i.category_id, i.type, i.amount, i.date,
      -- texto do banco intacto + complemento do usuário
      left(nullif(concat_ws(' | ', nullif(clean_desc, ''), nullif(btrim(i.note), '')), ''), 200),
      i.invoice_month, -- fatura do banco; null = o trigger calcula pelo cartão
      grp, i.installment_number, i.installment_total
    )
    returning id into tx;

    if cardinality(i.tags) > 0 then
      perform public.set_transaction_tags(array[tx], i.tags);
    end if;

    update public.import_items
    set status = 'approved', transaction_id = tx, decided_at = now()
    where id = i.id;

    approved := approved + 1;
  end loop;

  return approved;
end;
$$;

-- View de revisão recriada para incluir as colunas novas
drop view public.import_items_review;

create view public.import_items_review
with (security_invoker = true)
as
select
  i.*,
  exists (
    select 1 from public.transactions t
    where t.account_id = i.account_id
      and t.amount = i.amount
      and t.type = i.type
      and abs(t.date - i.date) <= 3
      and t.id is distinct from i.transaction_id -- não compara com a transação que ele mesmo gerou
  ) as possible_duplicate
from public.import_items i;

revoke all on public.import_items_review from anon;
