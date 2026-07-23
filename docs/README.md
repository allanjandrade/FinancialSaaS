# Documentação — Controle Financeiro

Índice oficial do projeto. Use este diretório como referência para deploy, desenvolvimento e uso.

## Produção e operação

1. **[PRODUCTION.md](./PRODUCTION.md)** — Overview completo: requisitos, checklist pré-go-live, segurança, monitoramento.
2. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Passo a passo: build, hosting estático, Edge Functions, variáveis de ambiente.
3. **[SUPABASE.md](./SUPABASE.md)** — Schema, migrações SQL, RLS, Realtime, convites família.

## Produto e técnico

4. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Camadas, stores Pinia, fluxo de dados local ↔ nuvem.
5. **[FAMILY-MODE.md](./FAMILY-MODE.md)** — Allan + Jessica em dispositivos diferentes: onboarding, convites, sync.
6. **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Setup dev, scripts, estrutura de pastas, convenções.
7. **[USER-GUIDE.md](./USER-GUIDE.md)** — Manual para usuários finais (PT-BR).
8. **[TESTING.md](./TESTING.md)** — Testes automatizados (Vitest).

## Documentos legados (raiz do repositório)

Arquivos como `PRODUCTION-DEPLOYMENT-GUIDE.md`, `FAMILY-SUPABASE-SETUP.md` e roadmaps antigos podem estar desatualizados. **Priorize sempre os arquivos desta pasta `docs/`.**

## Ordem recomendada para primeiro deploy

1. Configurar projeto Supabase e aplicar migrações (`docs/SUPABASE.md`).
2. Criar `.env` e validar login local (`docs/DEVELOPMENT.md`).
3. Seguir checklist em `docs/PRODUCTION.md`.
4. Publicar frontend (`docs/DEPLOYMENT.md`).
5. Testar sync Realtime com dois navegadores/dispositivos (`docs/FAMILY-MODE.md`).
