# Painel de edição — hospedagem 100% Cloudflare

Guia para publicar o site no Cloudflare Pages (grátis) e ativar o
painel `/admin` sem depender do Netlify.

## 1. Publicar o site no Cloudflare Pages

1. Acesse o [dashboard da Cloudflare](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → aba **Pages** → **Connect to Git**.
2. Escolha o repositório `marcato-app/brisaloungebar`.
3. Build settings: deixe **Build command** vazio e **Build output directory** como `/` (é um site estático, sem build).
4. Deploy. Você recebe uma URL tipo `brisaloungebar.pages.dev` (dá pra trocar depois por um domínio próprio).

## 2. Criar o app OAuth no GitHub

O painel de edição precisa de permissão pra commitar no repositório em nome de quem loga.

1. Vá em [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.
2. Preencha:
   - **Homepage URL**: a URL do site publicado (ex: `https://brisaloungebar.pages.dev`)
   - **Authorization callback URL**: `https://brisa-cms-oauth.<seu-subdominio>.workers.dev/callback`
     (o `<seu-subdominio>` você só sabe depois do passo 3 — pode voltar aqui e editar depois)
3. Copie o **Client ID** gerado e gere um **Client Secret**.

## 3. Publicar o Worker de autenticação

Esse Worker faz só uma coisa: troca o código de login do GitHub por um token, pro painel poder salvar mudanças. Ele nunca vê o conteúdo do cardápio.

Pelo terminal (precisa de Node instalado):

```bash
cd oauth-worker
npx wrangler login          # abre o navegador pra autorizar
npx wrangler deploy         # publica o worker e mostra a URL final
npx wrangler secret put GITHUB_CLIENT_ID       # cola o Client ID do passo 2
npx wrangler secret put GITHUB_CLIENT_SECRET   # cola o Client Secret do passo 2
```

Anote a URL que o `wrangler deploy` mostrar (algo como
`https://brisa-cms-oauth.SEU-SUBDOMINIO.workers.dev`) — falta em dois lugares:

- No app OAuth do GitHub (passo 2), completando a callback URL.
- No arquivo `admin/config.yml` do site, no campo `base_url`.

## 4. Convidar o dono do bar

Não precisa de convite nenhum: ele só precisa ter (ou criar) uma conta
gratuita no GitHub e ter acesso de escrita ao repositório
`marcato-app/brisaloungebar` (Settings → Collaborators, no GitHub).
Depois disso ele acessa `seusite.pages.dev/admin`, clica em **Login with
GitHub**, autoriza uma vez, e já pode editar os preços.

## Custo

R$0. Cloudflare Pages e Workers têm camada gratuita generosa (100 mil
requisições/dia no Worker, bem mais que suficiente pra um painel de
edição usado ocasionalmente).
