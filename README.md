# Controle Financeiro

**Versão atual: 3.2.0**

Aplicação web de controle financeiro pessoal e familiar: receitas, despesas, cartões, benefícios (VA/VR), metas, maturidade financeira, assistente IA e modo família com sincronização em nuvem (Supabase).

## Stack

- **Frontend:** Vue 3, Vite, Pinia, Vue Router, Tailwind CSS
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Persistência local:** `localStorage` + sync opcional em `finance_states`

## Início rápido

```bash
npm install
cp .env.example .env
# Edite .env com URL e anon key do Supabase
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
npm run test:run
npm run validate:v3-release
```

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/README.md](docs/README.md) | Índice completo |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Checklist para ir a produção |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy (Vercel, Netlify, Supabase) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura e fluxos |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Banco, RLS, migrações, Realtime |
| [docs/FAMILY-MODE.md](docs/FAMILY-MODE.md) | Modo família e convites |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Desenvolvimento local |
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | Guia do usuário final |

## Principais rotas

| Rota | Tela |
|------|------|
| `/login` | Autenticação |
| `/` | Início / resumo |
| `/entries` | Lançamentos |
| `/dashboard` | Comando financeiro |
| `/analysis` | Análises executivas |
| `/structure` | Contas, cartões, benefícios |
| `/family` | Modo família (nuvem + convites) |
| `/plan` | Planejamento, compras IA e maturidade |
| `/ai` | Assistente IA |

## Licença

Uso privado do projeto familiar.
