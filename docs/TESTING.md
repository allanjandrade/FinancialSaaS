# Testes automatizados

## Stack

- [Vitest](https://vitest.dev/) — runner alinhado ao Vite
- [happy-dom](https://github.com/capricorn86/happy-dom) — ambiente DOM leve
- [@vue/test-utils](https://test-utils.vuejs.org/) — disponível para testes de componentes

## Comandos

```bash
npm install
npm run test        # modo watch
npm run test:run    # execução única (CI)
npm run test:coverage
```

## Estrutura

```
tests/
  setup.js                 # env stub + limpeza localStorage
  fixtures/
    family-state.js        # estado de família reutilizável
  unit/                    # funções puras (utils, api)
  stores/                  # Pinia com mocks
```

## O que é coberto

| Área | Arquivo |
|------|---------|
| Divisão de despesas / saldos família | `family-finance.test.js` |
| Maturidade financeira | `financial-maturity.test.js` |
| Patrimônio e sugestão de origem | `financial-consolidation.test.js` |
| Migração modo família | `family-migrate.test.js` |
| Compras IA (motivação, oportunidade) | `purchase-intelligence.test.js` |
| URL de convite | `family-supabase.test.js` |
| Store finance (persistência, sync) | `finance.test.js` |
| Store family-sync (bootstrap, teardown) | `family-sync.test.js` |

## CI (exemplo GitHub Actions)

```yaml
- run: npm ci
- run: npm run test:run
```

## Adicionar novos testes

1. Funções puras em `src/utils/` → `tests/unit/nome.test.js`
2. Stores → mockar Supabase em `tests/stores/`
3. Componentes Vue → `tests/components/Nome.spec.js` com `mount()` do test-utils

Prefira testar comportamento de negócio (splits, scores, sync) em vez de detalhes de implementação da UI.
