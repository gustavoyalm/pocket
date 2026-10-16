-- pocket: schema inicial — contas, categorias e transações
-- Cada linha pertence a um usuário (user_id) e o RLS garante que ninguém veja dados de outra pessoa.

-- Funções internas ficam fora do schema "public" para não serem expostas pela API
create schema if not exists private;

-- ─── Tipos ───────────────────────────────────────────────────────────
create type public.account_type as enum (
  'checking',     -- conta corrente
  'savings',      -- poupança
  'cash',         -- dinheiro
  'credit_card',  -- cartão de crédito
  'investment',   -- investimentos
  'other'
);

create type public.transaction_type as enum ('income', 'expense');

-- ─── Contas ──────────────────────────────────────────────────────────
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  type            public.account_type not null default 'checking',
  initial_balance numeric(14, 2) not null default 0,
  color           text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (id, user_id)
);

create index accounts_user_id_idx on public.accounts (user_id);

-- ─── Categorias ──────────────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  type       public.transaction_type not null,
  color      text,
  icon       text, -- nome de ícone do lucide (ex.: "shopping-cart")
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, type, name)
);

create index categories_user_id_idx on public.categories (user_id);

-- ─── Transações ──────────────────────────────────────────────────────
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null,
  category_id uuid,
  type        public.transaction_type not null,
  amount      numeric(14, 2) not null check (amount > 0), -- sempre positivo; o sinal vem do "type"
  description text check (char_length(description) <= 200),
  date        date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- FKs compostas: a conta/categoria precisa ser do mesmo usuário da transação
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function private.set_updated_at();

-- ─── Saldo por conta ─────────────────────────────────────────────────
-- security_invoker: a view respeita o RLS de quem consulta
create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  a.initial_balance
    + coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0) as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

create policy "own accounts" on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own categories" on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own transactions" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Usuários anônimos (sem login) não têm acesso a nada
revoke all on public.accounts, public.categories, public.transactions, public.account_balances from anon;

-- ─── Categorias padrão para cada novo usuário ────────────────────────
create function private.seed_default_categories(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, type, icon, color) values
    (uid, 'Moradia',           'expense', 'house',           '#6366f1'),
    (uid, 'Mercado',           'expense', 'shopping-cart',   '#22c55e'),
    (uid, 'Alimentação',       'expense', 'utensils',        '#f97316'),
    (uid, 'Transporte',        'expense', 'car',             '#0ea5e9'),
    (uid, 'Saúde',             'expense', 'heart-pulse',     '#ef4444'),
    (uid, 'Educação',          'expense', 'graduation-cap',  '#8b5cf6'),
    (uid, 'Lazer',             'expense', 'party-popper',    '#ec4899'),
    (uid, 'Assinaturas',       'expense', 'repeat',          '#14b8a6'),
    (uid, 'Compras',           'expense', 'shopping-bag',    '#f59e0b'),
    (uid, 'Contas e serviços', 'expense', 'receipt',         '#64748b'),
    (uid, 'Outros',            'expense', 'circle-ellipsis', '#a1a1aa'),
    (uid, 'Salário',           'income',  'briefcase',       '#22c55e'),
    (uid, 'Freelance',         'income',  'laptop',          '#0ea5e9'),
    (uid, 'Investimentos',     'income',  'trending-up',     '#8b5cf6'),
    (uid, 'Outros',            'income',  'circle-ellipsis', '#a1a1aa')
  on conflict (user_id, type, name) do nothing;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Usuários que já existiam antes desta migration também recebem as categorias
select private.seed_default_categories(id) from auth.users;
