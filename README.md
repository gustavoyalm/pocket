# pocket

App de finanças pessoais. Feito com React + Vite + Tailwind, com o Supabase como backend (auth + Postgres).

> Projeto em desenvolvimento.

## Rodando localmente

Requisitos: Node 24+ e um projeto no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a publishable key do seu projeto
npm run dev
```

## Deploy (Docker)

A imagem faz o build do app e serve os arquivos estáticos com nginx na porta `80`.
A configuração do Supabase é lida **em runtime** pelas variáveis de ambiente, então a mesma imagem serve pra qualquer instalação:

| Variável                   | Descrição                                   |
| -------------------------- | ------------------------------------------- |
| `SUPABASE_URL`             | URL do projeto (`https://xxxx.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (ou a anon key legada)      |

```bash
docker build -t pocket .
docker run -p 8080:80 -e SUPABASE_URL=... -e SUPABASE_PUBLISHABLE_KEY=... pocket
```

### EasyPanel

1. Crie um serviço **App** → fonte **GitHub** apontando para este repositório, branch `main`.
2. Build: **Dockerfile** (caminho `Dockerfile`).
3. Em **Environment**, defina `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
4. Em **Domains**, aponte o domínio para a porta `80`.
5. No Supabase, em **Authentication → URL Configuration**, coloque o domínio como *Site URL*.

## Créditos

O visual é inspirado no [budgero](https://github.com/tombadilo-bombadilo/budgero).

## Licença

[MIT](LICENSE)
