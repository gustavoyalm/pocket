-- Ao cadastrar um final num cartão, os itens pendentes da importação com esse final
-- (que chegaram sem cartão identificado) passam a apontar para ele.

create function private.link_pending_imports_to_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.import_items
  set account_id = new.id
  where user_id = new.user_id
    and status = 'pending'
    and account_id is null
    and card_final = any (new.card_finals);
  return new;
end;
$$;

create trigger accounts_link_pending_imports
  after insert or update of card_finals on public.accounts
  for each row when (new.type = 'credit_card' and cardinality(new.card_finals) > 0)
  execute function private.link_pending_imports_to_card();
