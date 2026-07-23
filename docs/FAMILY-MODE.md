# Modo família

Permite que **Allan** e **Jessica** (ou outros membros) compartilhem o mesmo panorama financeiro em celulares e computadores diferentes, com sincronização automática via Supabase.

## Modos de operação

| Modo | Quando usar |
|------|-------------|
| **Local** | Sem login ou sem família na nuvem; dados só no aparelho |
| **Nuvem** | Login + família criada ou convite aceito; sync + Realtime |

## Onboarding na nuvem (`/family`)

1. Faça login.
2. Acesse **Família** no menu.
3. **Criar família** — informe o nome (ex.: “Família Silva”).
4. Anote o **código de convite** ou envie convite por e-mail/link.
5. O segundo usuário:
   - Abre o link de convite **ou**
   - Em Família → **Entrar com código** + nome de exibição.

## Convites

- **Link:** contém token; ao abrir logado, aceita via RPC.
- **E-mail:** deve corresponder ao e-mail da conta Supabase do convidado.
- **QR:** gerado via serviço externo (pode ser substituído no futuro).

## O que sincroniza

Todo o JSON em `finance.state`, incluindo:

- Receitas e despesas (incl. compartilhadas e splits)
- Cartões, contas, VA/VR
- Metas, dívidas, acertos
- Configurações e histórico de maturidade

**Não sincroniza automaticamente:** sessão de login (cada um com sua conta).

## Indicadores na interface

- **Topbar:** badge `Ao vivo` (Realtime), `Sincronizando`, `Erro sync` ou `Nuvem`.
- **Toast:** “Dados atualizados por outro dispositivo” quando outro membro altera dados.

## Papéis

| Papel | Capacidades típicas |
|-------|---------------------|
| `administrator` | Convidar, remover membros, alterar papéis |
| `member` | Usar dados compartilhados |
| `viewer` | Somente leitura (conforme implementação na UI) |

## Boas práticas

1. Ambos devem estar **logados** e na **mesma família** antes de usar no dia a dia.
2. Evitem editar a **mesma despesa ao mesmo tempo**; prefiram divisão por quem pagou.
3. Faça **export JSON** periodicamente em Configurações como backup extra.
4. Se trocar de celular: login → entrar na família → aguardar pull automático.

## Resolução de problemas

- **Dados diferentes entre aparelhos:** puxe para baixo / recarregue; verifique badge de sync; confirme mesma família no hub.
- **Sem badge “Ao vivo”:** migração Realtime não aplicada ou rede bloqueando WebSocket.
- **Convite não funciona:** confira e-mail da conta vs. e-mail do convite.

## Arquivos relacionados

- `src/views/FamilyHub.vue`
- `src/stores/family-sync.js`
- `src/api/family-supabase.js`
- `src/utils/family-finance.js`
