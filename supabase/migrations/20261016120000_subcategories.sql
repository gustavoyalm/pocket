-- Categorias em dois níveis (categoria → subcategoria).
-- Toda transação passa a exigir uma subcategoria do mesmo tipo (receita/despesa).

-- ─── Hierarquia ──────────────────────────────────────────────────────
alter table public.categories add column parent_id uuid;

alter table public.categories
  add constraint categories_parent_fkey
  foreign key (parent_id, user_id) references public.categories (id, user_id) on delete cascade;

create index categories_parent_user_idx on public.categories (parent_id, user_id);

-- Nome único por nível: "Outros" pode existir dentro de várias categorias
alter table public.categories drop constraint categories_user_id_type_name_key;
alter table public.categories
  add constraint categories_unique_name unique nulls not distinct (user_id, type, parent_id, name);

-- Regras da hierarquia: só 2 níveis e subcategoria com o mesmo tipo da categoria-pai
create function private.check_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.categories;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Uma categoria não pode ser subcategoria dela mesma.';
    end if;
    select * into parent from public.categories where id = new.parent_id;
    if parent.parent_id is not null then
      raise exception 'Subcategorias não podem ter subcategorias.';
    end if;
    if parent.type <> new.type then
      raise exception 'A subcategoria precisa ser do mesmo tipo da categoria-pai.';
    end if;
    if exists (select 1 from public.categories where parent_id = new.id) then
      raise exception 'Uma categoria com subcategorias não pode virar subcategoria.';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.type <> old.type and (
    exists (select 1 from public.categories where parent_id = new.id)
    or exists (select 1 from public.transactions where category_id = new.id)
  ) then
    raise exception 'Não é possível mudar o tipo de uma categoria em uso.';
  end if;

  return new;
end;
$$;

create trigger categories_check
  before insert or update on public.categories
  for each row execute function private.check_category();

-- ─── Categorias padrão (agora com subcategorias) ─────────────────────
create or replace function private.seed_default_categories(uid uuid)
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
  on conflict (user_id, type, parent_id, name) do nothing;

  insert into public.categories (user_id, name, type, parent_id)
  select uid, s.name, p.type, p.id
  from (values
    ('expense', 'Moradia',           'Aluguel'),
    ('expense', 'Moradia',           'Condomínio'),
    ('expense', 'Moradia',           'Energia'),
    ('expense', 'Moradia',           'Água'),
    ('expense', 'Moradia',           'Internet'),
    ('expense', 'Moradia',           'Manutenção'),
    ('expense', 'Mercado',           'Supermercado'),
    ('expense', 'Mercado',           'Feira'),
    ('expense', 'Mercado',           'Padaria'),
    ('expense', 'Alimentação',       'Restaurantes'),
    ('expense', 'Alimentação',       'Delivery'),
    ('expense', 'Alimentação',       'Lanches e café'),
    ('expense', 'Transporte',        'Combustível'),
    ('expense', 'Transporte',        'Aplicativos'),
    ('expense', 'Transporte',        'Transporte público'),
    ('expense', 'Transporte',        'Estacionamento'),
    ('expense', 'Transporte',        'Manutenção do veículo'),
    ('expense', 'Saúde',             'Farmácia'),
    ('expense', 'Saúde',             'Consultas'),
    ('expense', 'Saúde',             'Plano de saúde'),
    ('expense', 'Saúde',             'Exames'),
    ('expense', 'Saúde',             'Academia'),
    ('expense', 'Educação',          'Cursos'),
    ('expense', 'Educação',          'Livros'),
    ('expense', 'Educação',          'Mensalidade escolar'),
    ('expense', 'Lazer',             'Viagens'),
    ('expense', 'Lazer',             'Cinema e shows'),
    ('expense', 'Lazer',             'Bares'),
    ('expense', 'Lazer',             'Hobbies'),
    ('expense', 'Assinaturas',       'Streaming'),
    ('expense', 'Assinaturas',       'Apps e software'),
    ('expense', 'Compras',           'Roupas'),
    ('expense', 'Compras',           'Eletrônicos'),
    ('expense', 'Compras',           'Casa'),
    ('expense', 'Compras',           'Presentes'),
    ('expense', 'Contas e serviços', 'Telefone'),
    ('expense', 'Contas e serviços', 'Taxas bancárias'),
    ('expense', 'Contas e serviços', 'Impostos'),
    ('expense', 'Contas e serviços', 'Seguros'),
    ('expense', 'Outros',            'Diversos'),
    ('income',  'Salário',           'Salário mensal'),
    ('income',  'Salário',           '13º salário'),
    ('income',  'Salário',           'Férias'),
    ('income',  'Salário',           'Bônus e PLR'),
    ('income',  'Freelance',         'Projetos'),
    ('income',  'Investimentos',     'Rendimentos'),
    ('income',  'Investimentos',     'Dividendos'),
    ('income',  'Outros',            'Reembolsos'),
    ('income',  'Outros',            'Presentes recebidos'),
    ('income',  'Outros',            'Diversos')
  ) as s (type, parent, name)
  join public.categories p
    on p.user_id = uid
   and p.parent_id is null
   and p.type = s.type::public.transaction_type
   and p.name = s.parent
  on conflict (user_id, type, parent_id, name) do nothing;
$$;

select private.seed_default_categories(id) from auth.users;

-- ─── Transações: subcategoria obrigatória ────────────────────────────
-- Transações que apontavam para uma categoria-pai vão para a primeira subcategoria dela
update public.transactions t
set category_id = (
  select s.id from public.categories s
  where s.parent_id = t.category_id
  order by s.name
  limit 1
)
where exists (select 1 from public.categories c where c.id = t.category_id and c.parent_id is null);

-- Transações sem categoria vão para "Outros → Diversos" do tipo correspondente
update public.transactions t
set category_id = (
  select s.id from public.categories s
  join public.categories p on p.id = s.parent_id
  where s.user_id = t.user_id and s.type = t.type and p.name = 'Outros' and s.name = 'Diversos'
)
where t.category_id is null;

-- Categoria em uso não pode ser excluída (antes virava null; agora é obrigatória)
alter table public.transactions drop constraint transactions_category_id_user_id_fkey;
alter table public.transactions
  add constraint transactions_category_id_user_id_fkey
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict;
alter table public.transactions alter column category_id set not null;

create function private.check_transaction_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat public.categories;
begin
  select * into cat from public.categories where id = new.category_id;
  if cat.parent_id is null then
    raise exception 'Escolha uma subcategoria.';
  end if;
  if cat.type <> new.type then
    raise exception 'A subcategoria precisa ser do mesmo tipo da transação.';
  end if;
  return new;
end;
$$;

create trigger transactions_check_category
  before insert or update of category_id, type on public.transactions
  for each row execute function private.check_transaction_category();

-- ─── Uso de cada categoria (quantas transações) ──────────────────────
create view public.category_usage
with (security_invoker = true)
as
select category_id, count(*)::int as transaction_count
from public.transactions
group by category_id;

revoke all on public.category_usage from anon;
