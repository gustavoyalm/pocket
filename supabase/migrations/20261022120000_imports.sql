-- Importação de transações de cartão (ex.: Open Finance via n8n) com aprovação manual.
--
-- Fluxo:
--   1. n8n chama public.ingest_import_items(token, itens) → itens caem em import_items (status 'pending')
--   2. o usuário revisa no app (cartão, categoria) e aprova → viram transações normais
--
-- O token de importação só permite jogar itens na caixa de entrada daquele usuário:
-- não lê nem altera mais nada. Guardamos só o hash (sha256) do token.

-- ─── Finais do cartão (vínculo com a importação) ─────────────────────
alter table public.accounts
  add column card_finals text[] not null default '{}',
  add constraint accounts_card_finals check (cardinality(card_finals) = 0 or type = 'credit_card');

create index accounts_card_finals_idx on public.accounts using gin (card_finals);

-- Um mesmo final não pode estar em dois cartões do mesmo usuário
create function private.check_card_finals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.accounts a
    where a.user_id = new.user_id and a.id <> new.id and a.card_finals && new.card_finals
  ) then
    raise exception 'Um desses finais já está cadastrado em outro cartão.';
  end if;
  return new;
end;
$$;

create trigger accounts_check_card_finals
  before insert or update of card_finals on public.accounts
  for each row when (cardinality(new.card_finals) > 0)
  execute function private.check_card_finals();

-- ─── Tokens de importação ────────────────────────────────────────────
create table public.import_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label        text not null default 'n8n' check (char_length(label) between 1 and 60),
  token_hash   text not null unique,
  token_hint   text not null, -- últimos caracteres, só para reconhecer na tela
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index import_tokens_user_idx on public.import_tokens (user_id);

alter table public.import_tokens enable row level security;

create policy "own import tokens" on public.import_tokens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.import_tokens from anon;

-- Gera um token novo; o valor em texto é devolvido UMA vez e nunca mais fica disponível
create function public.create_import_token(p_label text default 'n8n')
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  token text := 'pkt_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.import_tokens (label, token_hash, token_hint)
  values (coalesce(nullif(btrim(p_label), ''), 'n8n'), encode(extensions.digest(token, 'sha256'), 'hex'), right(token, 4));
  return token;
end;
$$;

revoke execute on function public.create_import_token from public, anon;
grant execute on function public.create_import_token to authenticated;

-- ─── Caixa de entrada ────────────────────────────────────────────────
create table public.import_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source             text not null default 'open_finance',
  external_id        text not null,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- dados vindos do banco
  card_final         text,
  description        text not null,
  amount             numeric(14, 2) not null check (amount > 0),
  type               public.transaction_type not null,
  date               date not null,       -- data do lançamento (da parcela)
  purchase_date      date,                -- data da compra original
  invoice_month      date check (extract(day from invoice_month) = 1),
  installment_number smallint,
  installment_total  smallint,
  bank_category      text,
  bank_status        text,
  operation          text,
  raw                jsonb not null,
  -- escolhas da revisão
  account_id         uuid,
  category_id        uuid,
  transaction_id     uuid,
  received_at        timestamptz not null default now(),
  decided_at         timestamptz,
  unique (user_id, source, external_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete set null (transaction_id)
);

create index import_items_user_status_idx on public.import_items (user_id, status);
create index import_items_account_idx on public.import_items (account_id, user_id);
create index import_items_category_idx on public.import_items (category_id, user_id);
create index import_items_transaction_idx on public.import_items (transaction_id, user_id);

alter table public.import_items enable row level security;

create policy "own import items" on public.import_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.import_items from anon;

-- Lembra a categoria escolhida para cada categoria do banco ("Vestuário" → Compras › Roupas)
create table public.import_category_rules (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source        text not null default 'open_finance',
  bank_category text not null,
  category_id   uuid not null,
  updated_at    timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

create unique index import_category_rules_key on public.import_category_rules (user_id, source, lower(bank_category));
create index import_category_rules_category_idx on public.import_category_rules (category_id, user_id);

alter table public.import_category_rules enable row level security;

create policy "own import category rules" on public.import_category_rules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.import_category_rules from anon;

-- ─── Entrada (chamada pelo n8n) ──────────────────────────────────────
-- security definer: quem chama não está logado; o token identifica o usuário.
-- Aceita um objeto ou uma lista. Itens repetidos (mesmo id) são ignorados.
create function public.ingest_import_items(p_token text, p_items jsonb)
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
  errors jsonb := '[]';
  parcel text[];
  card_final_v text;
  bank_cat text;
  n_rows int;
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
        (item->>'data')::date,
        (item->>'data_compra')::date,
        case when item->>'fatura' ~ '^\d{4}-\d{2}$' then (item->>'fatura' || '-01')::date end,
        case when parcel is not null and parcel[2]::int > 1 then parcel[1]::smallint end,
        case when parcel is not null and parcel[2]::int > 1 then parcel[2]::smallint end,
        bank_cat,
        item->>'status',
        item->>'operacao',
        item,
        -- cartão pelo final
        (select a.id from public.accounts a
          where a.user_id = uid and a.type = 'credit_card' and card_final_v = any (a.card_finals) limit 1),
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
    'erros', errors
  );
end;
$$;

revoke execute on function public.ingest_import_items from public;
grant execute on function public.ingest_import_items to anon, authenticated;

-- ─── Revisão: itens com aviso de possível duplicidade ────────────────
-- Possível duplicada: já existe no mesmo cartão uma transação de mesmo valor e tipo
-- com data até 3 dias de diferença (ex.: lançada à mão antes da importação).
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

-- ─── Aprovação ───────────────────────────────────────────────────────
-- Aprova os itens pendentes que já têm cartão e categoria. Devolve quantos foram aprovados.
-- security invoker: roda com o RLS de quem chama.
create function public.approve_import_items(p_ids uuid[])
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
begin
  for i in
    select * from public.import_items
    where id = any (p_ids) and status = 'pending' and account_id is not null and category_id is not null
    order by date
  loop
    -- "Shein *Shein.Com 12/12" → "Shein *Shein.Com" (a parcela fica nos campos próprios)
    clean_desc := btrim(regexp_replace(i.description, '\s*\d+\s*/\s*\d+\s*$', ''));

    insert into public.transactions (
      account_id, category_id, type, amount, date, description, invoice_month,
      installment_group, installment_number, installment_total
    ) values (
      i.account_id, i.category_id, i.type, i.amount, i.date, nullif(clean_desc, ''), i.invoice_month,
      -- parcelas da mesma compra ficam no mesmo grupo (mesmo cartão, data da compra, descrição e nº de parcelas)
      case when i.installment_total is not null then
        extensions.uuid_generate_v5(
          extensions.uuid_ns_oid(),
          concat_ws('|', i.user_id, i.account_id, coalesce(i.purchase_date, i.date), lower(clean_desc), i.installment_total)
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

revoke execute on function public.approve_import_items from public, anon;
grant execute on function public.approve_import_items to authenticated;
