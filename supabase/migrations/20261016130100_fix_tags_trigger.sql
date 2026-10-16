-- Correção: o trigger chamava private.normalize_tags(), mas usuários comuns não têm acesso
-- ao schema "private". A padronização passa a ficar dentro do próprio trigger.

create or replace function private.prepare_transaction_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sem espaços extras, minúsculas, sem vazias nem repetidas (mantém a ordem)
  select coalesce(array_agg(tag order by first_pos), '{}')
  into new.tags
  from (
    select lower(regexp_replace(trim(raw), '\s+', ' ', 'g')) as tag, min(pos) as first_pos
    from unnest(new.tags) with ordinality as u (raw, pos)
    where trim(raw) <> ''
    group by 1
  ) t;

  if cardinality(new.tags) > 20 then
    raise exception 'Máximo de 20 tags por transação.';
  end if;
  if exists (select 1 from unnest(new.tags) t where char_length(t) > 40) then
    raise exception 'Cada tag pode ter no máximo 40 caracteres.';
  end if;
  return new;
end;
$$;

drop function private.normalize_tags(text[]);
