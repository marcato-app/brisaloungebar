# Painel de edição — hospedagem 100% Cloudflare

Guia para ativar o painel `/admin`, tudo pelo painel da Cloudflare (sem terminal).

## 1. Site principal — ✅ já publicado

`https://brisaloungebar.gaabmgomes.workers.dev`

## 2. Criar o app OAuth no GitHub

1. [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. Preencha:
   - **Application name**: Brisa Lounge Bar CMS
   - **Homepage URL**: `https://brisaloungebar.gaabmgomes.workers.dev`
   - **Authorization callback URL**: por enquanto, qualquer coisa (edita depois do passo 3) — ex: `https://brisaloungebar.gaabmgomes.workers.dev`
3. Clique **Register application**.
4. Copie o **Client ID** mostrado na tela.
5. Clique **Generate a new client secret** e copie o valor (só aparece uma vez).

## 3. Publicar o Worker de autenticação (pelo painel, sem terminal)

Esse Worker só troca o login do GitHub por um token — nunca vê o cardápio.

1. No dashboard da Cloudflare → **Workers & Pages** → **Create** → **Connect to Git**.
2. Escolha o mesmo repositório `marcato-app/brisaloungebar`.
3. Em **Root directory** (nas configurações avançadas), digite `oauth-worker`.
4. Em **Project name**, digite exatamente `brisa-cms-oauth` (precisa bater com o `name` do `wrangler.toml` dessa pasta).
5. Build command: vazio. Deploy command: deixa o padrão (`npx wrangler deploy`).
6. **Deploy**. Você recebe uma URL tipo `https://brisa-cms-oauth.gaabmgomes.workers.dev`.

## 4. Conectar as três pontas

- Volte no app OAuth do GitHub (passo 2) e edite a **Authorization callback URL** para:
  `https://brisa-cms-oauth.gaabmgomes.workers.dev/callback`
- Nesse novo Worker, vá em **Settings → Variables and Secrets → Add secret** e crie:
  - `GITHUB_CLIENT_ID` = o Client ID do passo 2
  - `GITHUB_CLIENT_SECRET` = o Client Secret do passo 2
- No repositório, o arquivo `admin/config.yml` precisa ter `base_url` apontando pra essa
  mesma URL do Worker (sem o `/callback` no final). Me manda a URL que eu atualizo isso.

## 5. Dar acesso a quem for editar

O dono do bar precisa de uma conta gratuita no GitHub com acesso de escrita ao
repositório (`Settings → Collaborators` no repo). Depois disso ele acessa
`https://brisaloungebar.gaabmgomes.workers.dev/admin/`, clica em **Login with
GitHub**, autoriza uma vez, e já pode editar os preços.

## Custo

R$0 — os dois Workers ficam bem dentro da camada gratuita da Cloudflare.
