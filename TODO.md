# TODO - Melhorias (Plano priorizado)

## Fase 1 — Segurança + Drawer/overflow imediato
- [ ] Segurança: remover `geminiApiKey` do `index.html` (não deve existir no front)
- [ ] Segurança: atualizar `app.js` para **não** chamar Gemini direto do browser
- [ ] Segurança: fazer o front chamar a Edge Function `supabase/functions/ai-assistant` para chat e processamento de comprovante
- [ ] Layout: remover debug de overflow em `app.js` (`querySelectorAll('*')...offsetWidth...outline...`)
- [ ] Layout: revisar/ajustar `styles.css` para evitar overflow horizontal e garantir Drawer estável no mobile
- [ ] Teste: abrir `index.html`, validar menu mobile (drawer abre/fecha) e testar chat IA + envio de comprovante


## Fase 2 — Tabs em Configurações (médio)
- [ ] Converter `view-settings` para Tabs (Perfil/Família/Documentação)
- [ ] Garantir transições e renderização correta das seções

## Fase 3 — SPA/Framework + Tokens (futuro)
- [ ] Planejar migração para Vue/React
- [ ] Planejar padronização de tokens/design system (Tailwind ou equivalente)

