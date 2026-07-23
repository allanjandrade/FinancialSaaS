# Release 5 - Preflight obrigatorio

Data: 18/06/2026.

## Regra da Release 5

Fluxo permitido:

`template -> parametro -> agendamento controlado -> lock -> dedupe -> cooldown -> log -> notificacao in-app`

Restricoes:

- Nada de script livre.
- Nada de automacao por IA.
- Nada de cron sem trava.
- Nada de alerta duplicado.
- Nada de WhatsApp, Gmail ou Google nesta release.

## Snapshot pre-alteracao

- Arquivo: `backups/release-5-prechange-20260618-142159/project-source.zip`.
- SHA-256: `17A714B41E1436F5948C8F8F6D9AF597D78219DEE619FFF3AB840B0D9D3BFC25`.
- Inventario: 286 arquivos de fonte.
- Branch: `master`.
- Commit base: `2a77aba2426cf47ee572be7810f4baaed71fa818`.
- Baseline: `backups/release-5-prechange-20260618-142159/baseline.txt`.

## Baseline validado

- `npm run build`: PASS.
- `npm run test`: PASS, 29 arquivos e 122 testes.
- `npm run e2e`: PASS, Cypress real 25/25.
- `npm run validate:financial-consistency`: PASS.
- `npm run validate:financial-engine`: PASS.
- `npm run validate:ai-assist`: PASS.
- `npm run validate:ai-actions`: PASS.
- `supabase db lint --linked --level warning --fail-on error`: PASS, sem erros de schema.

## Decisao

Gate pre-Release 5 aprovado. A Release 5 ainda nao foi implementada neste passo; o proximo trabalho deve respeitar estritamente o fluxo controlado acima.
