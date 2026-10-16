-- Tags livres nas transações (ex.: "viagem", "reembolsável")

alter table public.transactions add column tags text[] not null default '{}';

-- Padroniza: sem espaços extras, minúsculas, sem vazias nem repetidas (mantém a ordem)
create function private.normalize_tags(input text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(tag order by first_pos), '{}')
  from (
    select lower(regexp_replace(trim(raw), '\s+', ' ', 'g')) as tag, min(pos) as first_pos
    from unnest(input) with ordinality as u (raw, pos)
    where trim(raw) <> ''
    group by 1
  ) t;
$$;

create function private.prepare_transaction_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.tags := private.normalize_tags(new.tags);
  if cardinality(new.tags) > 20 then
    raise exception 'Máximo de 20 tags por transação.';
  end if;
  if exists (select 1 from unnest(new.tags) t where char_length(t) > 40) then
    raise exception 'Cada tag pode ter no máximo 40 caracteres.';
  end if;
  return new;
end;
$$;

create trigger transactions_prepare_tags
  before insert or update of tags on public.transactions
  for each row execute function private.prepare_transaction_tags();

create index transactions_tags_idx on public.transactions using gin (tags);

-- Tags já usadas pelo usuário (para sugestões e filtro), com contagem de uso
create view public.transaction_tags
with (security_invoker = true)
as
select tag, count(*)::int as uses
from public.transactions, unnest(tags) as tag
group by tag;

revoke all on public.transaction_tags from anon;
