# Plano - Release 3.1 Motor de Entrada e Conciliação

1. Criar testes RED para o domínio de conciliação.
2. Criar testes RED para o contrato da store e da tela de lançamentos.
3. Implementar `src/domain/reconciliation/reconciliationEngine.js` com funções puras.
4. Integrar o motor no `financeStore`, incluindo histórico de sessões e rollback.
5. Atualizar `Entries.vue` para usar prévia com resumo, status por linha e confirmação segura.
6. Atualizar versionamento e documentação da release.
7. Rodar testes focados, suíte completa e build.

## Riscos

- A tela de lançamentos já possui OCR e anexos; manter o upgrade no bloco de extrato evita interferir no fluxo de documentos.
- A store calcula saldo ao adicionar/remover lançamentos; rollback deve reutilizar exclusões existentes para preservar consistência.
- A conciliação de assinatura deve usar o motor existente de assinaturas para não duplicar regra de negócio.
