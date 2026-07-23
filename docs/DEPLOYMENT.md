# Deploy

## 1. Preparar ambiente

```bash
git clone <repo>
cd App_test
npm ci
cp .env.example .env
```

Preencha `.env` com credenciais do projeto Supabase de **produção**.

## 2. Build

```bash
npm run build
```

Artefatos em `dist/`. Não é necessário Node no servidor — apenas arquivos estáticos.

## 3. Vercel (recomendado)

1. Importe o repositório na Vercel.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` = URL da Vercel (ex.: `https://controle.vercel.app`)
6. Deploy.

O arquivo `vercel.json` na raiz já configura rewrite SPA.

## 4. Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Adicione variáveis de ambiente no painel.
4. O arquivo `public/_redirects` envia todas as rotas para `index.html`.

## 5. Supabase — migrações

### Opção A: SQL Editor

Execute em ordem os arquivos em `supabase/migrations/`:

1. `20260601120000_family_invites_rls.sql` (se ainda não aplicado)
2. `20260601130000_finance_states_realtime.sql`

### Opção B: CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

## 6. Edge Functions

```bash
supabase functions deploy ai-assistant
supabase functions deploy receipt-ocr
supabase functions deploy statement-ocr
supabase functions deploy chat
```

Defina secrets no projeto:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set GEMINI_API_KEY=... # OCR de extratos por imagem/PDF escaneado
# Opcional: provider OCR proprio para texto bruto
supabase secrets set DOCUMENT_OCR_ENDPOINT=...
supabase secrets set DOCUMENT_OCR_API_KEY=...
```

Ajuste `supabase/functions/_shared/cors.ts` para incluir seu domínio de produção.

## 7. Auth — URLs

No Supabase Dashboard → Authentication → URL Configuration:

| Campo | Exemplo |
|-------|---------|
| Site URL | `https://app.seudominio.com` |
| Redirect URLs | `https://app.seudominio.com/**` |

## 8. Verificação pós-deploy

1. Abrir `/login` e autenticar.
2. Navegar `/`, `/entries`, `/family`.
3. Criar família e convidar segundo usuário.
4. Dois browsers: editar despesa em um → toast no outro.
5. Testar upload de nota (OCR) se função deployada.

## Rollback

- Frontend: redeploy commit anterior na Vercel/Netlify.
- Banco: restaurar backup Supabase (Point-in-Time em planos pagos).
- Não faça `force push` em `main` sem alinhamento.
