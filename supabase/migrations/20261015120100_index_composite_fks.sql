-- Índices que cobrem as FKs compostas (conta/categoria + usuário) das transações
drop index public.transactions_account_id_idx;
drop index public.transactions_category_id_idx;

create index transactions_account_user_idx on public.transactions (account_id, user_id);
create index transactions_category_user_idx on public.transactions (category_id, user_id);
