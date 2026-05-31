# Checklist de Implantação em Produção

## Problemas de Segurança Críticos (DEVEM SER CORRIGIDOS ANTES DA IMPLANTAÇÃO)

### 1. Remover Credenciais Codificadas
- [ ] **CRÍTICO**: Excluir arquivo `supabase-config.js` (contém chaves de API codificadas)
- [ ] Criar `config.js` a partir de `config.js.example` com credenciais de produção
- [ ] Configurar variáveis de ambiente no Netlify: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Verificar se `.gitignore` exclui tanto `config.js` quanto `supabase-config.js`

### 2. Remover Declarações de Console
- [ ] Remover todas as declarações `console.log`, `console.error`, `console.warn` do código de produção
- [ ] Encontrado em: `app.js` (18), `auth.js` (4), `family-setup.js` (3)

## Configuração do Banco de Dados
- [ ] Executar `supabase-setup-clean.sql` na instância de produção do Supabase
- [ ] Verificar se as políticas RLS estão configuradas corretamente
- [ ] Testar conexões e permissões do banco de dados
- [ ] Verificar se os índices foram criados para performance

## Configuração de Segurança
- [x] Adicionar headers de segurança ao `netlify.toml` (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] Remover arquivos sensíveis do cache do service worker
- [x] Atualizar `.gitignore` para excluir arquivos de configuração sensíveis
- [ ] Habilitar HTTPS no Netlify (automático, mas verificar)
- [ ] Configurar headers CSP se necessário
- [ ] Revisar e testar fluxo de autenticação

## Teste do Aplicativo
- [ ] Testar registro e login de usuário
- [ ] Testar criação de família e convite de membros
- [ ] Testar entrada e sincronização de dados financeiros
- [ ] Testar funcionalidade do assistente de IA
- [ ] Testar upload de arquivos (escaneamento de comprovantes)
- [ ] Testar funcionalidade offline (service worker)
- [ ] Testar funcionalidade de exportação
- [ ] Testar todos os papéis e permissões de usuário

## Otimização de Performance
- [ ] Minificar arquivos JavaScript e CSS
- [ ] Otimizar imagens
- [ ] Habilitar compressão no Netlify
- [ ] Testar tempos de carregamento
- [ ] Verificar estratégia de cache do service worker

## Compatibilidade de Navegador
- [ ] Testar no Chrome, Firefox, Safari, Edge
- [ ] Testar em dispositivos móveis (iOS, Android)
- [ ] Testar design responsivo
- [ ] Verificar se a instalação do PWA funciona

## Passos de Implantação
1. **Pré-implantação**
   - Remover todas as credenciais codificadas
   - Configurar variáveis de ambiente no Netlify
   - Executar migrações do banco de dados
   - Testar toda a funcionalidade localmente

2. **Implantação**
   - Conectar repositório ao Netlify
   - Configurar configurações de build (se houver)
   - Configurar variáveis de ambiente no painel do Netlify
   - Implantar em produção

3. **Pós-implantação**
   - Testar toda a funcionalidade crítica
   - Monitorar logs de erro
   - Testar fluxo de autenticação
   - Verificar conectividade do banco de dados
   - Testar sincronização em tempo real

## Monitoramento e Manutenção
- [ ] Configurar rastreamento de erros (Sentry, LogRocket, etc.)
- [ ] Configurar analytics
- [ ] Configurar backups do banco de dados
- [ ] Monitorar uso e limites da API
- [ ] Auditorias de segurança regulares

## Plano de Rollback
- [ ] Manter versão anterior disponível
- [ ] Documentar procedimento de rollback
- [ ] Testar processo de rollback

## Notas
- O aplicativo usa JavaScript vanilla sem sistema de build
- Supabase é usado para backend e autenticação
- Netlify é a plataforma de implantação
- Service worker está configurado para funcionalidade PWA
- Sincronização em tempo real é implementada via assinaturas do Supabase
