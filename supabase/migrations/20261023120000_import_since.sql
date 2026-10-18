-- Corte de importação por cartão: não traz o histórico antigo.
-- Itens de faturas anteriores a accounts.import_since são descartados na chegada (nem entram na caixa).
-- O corte é pela FATURA (não pela data da compra): parcelas futuras de compras antigas continuam entrando.
-- Cartão não identificado (ou sem corte definido): corte = mês atual.

alter table public.accounts
  add column import_since date check (extract(day from import_since) = 1),
  add constraint accounts_import_since_card check (import_since is null or type = 'credit_card');

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
  errors jsonb := '[]';
  parcel text[];
  card_final_v text;
  bank_cat text;
  n_rows int;
  v_account uuid;
  v_since date;
  v_date date;
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
      parcel := regexp_match(coalesce(item->>'parcela', ''), '^\s*(\d+)\s*/\s*(\d+)\s*$');
      card_final_v := nullif(regexp_replace(coalesce(item->>'cartao_final', ''), '\D', '', 'g'), '');
      bank_cat := nullif(btrim(item->>'categoria'), '');
      v_date := (item->>'data')::date;
      v_invoice := case when item->>'fatura' ~ '^\d{4}-\d{2}$' then (item->>'fatura' || '-01')::date end;

      v_account := null;
      v_since := null;
      select a.id, a.import_since into v_account, v_since
      from public.accounts a
      where a.user_id = uid and a.type = 'credit_card' and card_final_v = any (a.card_finals)
      limit 1;

      -- Corte: fatura (ou mês do lançamento) anterior ao início da importação → descarta
      if coalesce(v_invoice, date_trunc('month', v_date::timestamp)::date)
         < coalesce(v_since, date_trunc('month', current_date::timestamp)::date) then
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
        (item->>'data_compra')::date,
        v_invoice,
        case when parcel is not null and parcel[2]::int > 1 then parcel[1]::smallint end,
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
    'erros', errors
  );
end;
$$;
