# Rotina Pet — Postgres

Next.js + TypeScript + Drizzle. Produção usa Neon Postgres e Neon Auth; desenvolvimento e testes usam PGlite (Postgres embarcado, sem Docker), com autenticação local sem rede. Cada conta possui suas rotinas, atividades, pontos e sequência.

## Rodar localmente

Requer **Node.js 22+**. O runtime Neon usa o WebSocket nativo do Node; não requer dependência `ws` adicional.

```powershell
npm ci
npm run db:migrate
npm run dev
```

Abra http://127.0.0.1:3000 e crie uma conta em `/criar-conta`; `/entrar` permite entrar novamente e Sair revoga a sessão. Contas locais são exclusivas desse ambiente, sem vínculo com Neon Auth. Sem variáveis de banco, o padrão é PGlite em `data/pglite`. Para outro diretório dentro do projeto, use `$env:DATABASE_URL='pglite:./data/outro-pg'`. Para testes efêmeros, `memory://`. Caminhos fora do projeto, traversal, links que escapem do projeto, URL de rede e formatos inválidos são recusados. Execute migrations locais com o servidor parado: PGlite não é um servidor de banco para múltiplos processos abrirem o mesmo diretório simultaneamente.

App e scripts leem o ambiente do processo. Next.js também carrega `.env`; os scripts não carregam esse arquivo automaticamente. `.env.example` contém somente nomes vazios. Não use URI de produção no desenvolvimento: dev/teste recusam conexão remota, e produção/Vercel recusam PGlite e configuração ausente.

**A Fase 7 substituiu as migrations SQLite por uma inicial Postgres.** A Fase 5 acrescenta `0001_ordinary_firelord.sql`, não destrutiva: adiciona `user_id` nullable nas três tabelas existentes. Dados antigos são preservados como órfãos e ficam inacessíveis pelas contas; nenhum cadastro assume dados antigos automaticamente. Não apagar a migration inicial nem recriar o banco de produção. Os dados SQLite anteriores não são importados.

```powershell
npm test
npm run build
npm run typecheck
```

Os testes usam Postgres real embarcado em PGlite, incluindo transações, constraints, migrations e Promise.all. O teste de persistência fecha e reabre um diretório temporário dentro de `data/`. Nenhum teste conecta a banco remoto. Os arquivos de testes rodam sequencialmente para limitar o uso de memória dos motores embarcados.

## Regras preservadas

- Concluir rende +10 e bônus `min(dias consecutivos incluindo hoje - 1, 5)` por conclusão. Pular registra -5, limitado ao saldo disponível; nunca há dívida ou saldo negativo. Não há pulo automático.
- Um índice único por atividade/dia impede concluir e pular o mesmo item no mesmo dia. Repetir a mesma ação é idempotente; a oposta é rejeitada. UUID v4, nome 2–80, dias 0–6 e horário opcional HH:MM são validados no servidor.
- Dias são civis em `America/Sao_Paulo`. Sequência exige pelo menos uma conclusão por dia corrido; várias conclusões contam como um dia, mas cada uma ganha o bônus correspondente. Pular não apaga conclusões; um dia inteiro sem conclusão quebra a sequência. Antes da primeira conclusão de hoje, a sequência atual mostra o trecho até ontem.
- Humor: menos de 40% concluído fica triste; 40% a menos de 70%, ok; 70% ou mais, feliz. Sem atividades previstas, ok. Puladas permanecem no denominador, sem contar como concluídas.
- Hoje filtra rotinas e atividades ativas pela agenda semanal em SP. Horário é referência opcional, sem bloquear conclusão antecipada. `/rotinas` edita e arquiva, preservando IDs e histórico. Não há exclusão ou restauração pela interface.
- O histórico mostra os 30 registros mais recentes, com base, bônus, penalidade e saldo. Arquivar ou editar não altera pontos passados. Detalhes em `PRODUCT.md`.

## Atomicidade Postgres

Lançamentos usam transação **READ COMMITTED**. A primeira instrução obtém `pg_advisory_xact_lock(hashtextextended(userId, 724681))`, parametrizado pelo usuário da sessão; só depois lê seu saldo, sequência e resolução do dia. Colisões do hash apenas causam espera adicional. A ordem de lançamento é única por usuário; o índice atividade/dia continua impedindo concluir e pular juntos. Leituras de rotina e atividade usam `FOR SHARE`, impedindo arquivamento concorrente de invalidar a decisão. Todas as consultas e escritas de produto exigem identidade do servidor e filtram `user_id`; IDs de terceiros e inexistentes têm o mesmo erro. Não há RLS: a autorização é da aplicação.

## Login — Fase 5

Implementado com o SDK oficial **`@neon/auth@0.8.2`**, por ações de servidor de e-mail/senha, `createNeonAuth`, proxy de rotas e handler da API conforme o [guia Next.js](https://neon.com/docs/auth/quick-start/nextjs-api-only) e a [referência do servidor](https://neon.com/docs/auth/reference/nextjs-server). Google/social não foi implementado. A interface `getCurrentUser` usa um adaptador Neon em produção/Vercel e outro local somente em dev/teste. Não há flag para habilitar o local no deploy.

Na Vercel, o dono/maestro configura:

- `NEON_AUTH_BASE_URL`, já provisionado no projeto: endpoint HTTPS do Neon Auth.
- **`NEON_AUTH_COOKIE_SECRET`**, obrigatório pelo SDK, aleatório e com pelo menos 32 caracteres. Gere fora de arquivos versionados e cadastre como segredo; use o mesmo valor nas instâncias do ambiente. Sem ele o login falha fechado. Não é a senha do banco.
- `VITE_NEON_AUTH_URL` é mantido no exemplo por compatibilidade com a integração provisionada, mas este app Next.js usa a variável do servidor acima; não expõe endpoint ou segredo em variável pública.

Configure os domínios confiáveis e e-mail/senha no Neon Auth. O cadastro com verificação obrigatória depende da configuração do provedor e entrega de e-mail; a tela informa conferir e-mail quando não há sessão. A UI de código OTP e recuperação de senha não faz parte desta entrega; se a verificação usa código, ela exige uma próxima implementação antes de ativar esse fluxo. Nenhuma configuração remota foi alterada. Validar o fluxo provisionado com QA autorizado antes de abrir acesso público.

O SDK gerencia cookies de produção Secure/HttpOnly/SameSite=Lax; logs do SDK ficam desabilitados. `getSession` ignora cache do cookie para autorizar cada operação contra a sessão atual; Sair chama revogação do SDK e limpeza de cookies. Localmente as senhas usam scrypt com salt aleatório e comparação constante; apenas hashes de tokens de sessão são persistidos. Cookie local é HttpOnly/SameSite=Lax e não Secure para HTTP loopback; o servidor de desenvolvimento escuta somente 127.0.0.1. Não usar contas/senhas reais no adaptador local.

Sem sessão, `/` e `/rotinas` redirecionam a `/entrar` antes de consultar dados. Autenticados em `/entrar` ou `/criar-conta` vão para `/`. Cada ação exige novamente sessão, inclusive quando chamada fora da página. Não se aceita `user_id` do formulário.

Neon usa `@neondatabase/serverless` com Pool WebSocket e `drizzle-orm/neon-serverless`, que suportam transações interativas. PGlite usa `drizzle-orm/pglite`, com o mesmo schema `pg-core`. Não há cálculo de saldo fora da transação nem dependência de SQL de outro motor. Referências: [Drizzle + Neon](https://orm.drizzle.team/docs/connect-neon), [transações Drizzle](https://orm.drizzle.team/docs/transactions), [locks Postgres](https://www.postgresql.org/docs/current/explicit-locking.html) e [PGlite](https://pglite.dev/docs/api).

## Deploy Vercel + Neon — maestro/dono

Esta tarefa não faz push, cria recursos ou executa migration remota.

1. Na Vercel, **Storage > Neon > conectar ao projeto em Production**. A integração fornece a conexão Postgres; o app aceita `DATABASE_URL` e, na ausência dela, `POSTGRES_URL`. Use a URI padrão Neon (`postgres://` ou `postgresql://`, host `*.neon.tech`, usuário, senha e nome do banco). Senhas ficam somente no ambiente sensível do servidor, nunca em `NEXT_PUBLIC_*` ou no Git. [Integração oficial](https://neon.com/docs/guides/vercel-managed-integration).
2. Mantenha `DATABASE_URL_UNPOOLED` se fornecida: migrations a preferem a `DATABASE_URL`/`POSTGRES_URL`; o runtime não a usa. URI de conexão, senha ou token nunca são escritos em logs ou erros próprios. TLS desativado e parâmetros que substituam host/credenciais são rejeitados.
3. Configure Node.js 22+ e mantenha as dependências de desenvolvimento durante o build (o migrator usa `tsx`). `vercel.json` mantém região `gru1` e `npm run vercel-build`. Configure `main` como branch de produção. O push e a ativação da integração Git são feitos pelo maestro quando autorizados.
4. Mantenha **All Deployments + Vercel Authentication** até concluir o QA de login e a decisão do dono sobre acesso público. Standard Protection deixa o domínio de produção público. Valide os domínios e URLs geradas em acesso anônimo antes de liberar. [Deployment Protection](https://vercel.com/docs/deployment-protection).
5. Garanta que as variáveis de sistema exponham `VERCEL` e `VERCEL_ENV=production` ao build. `vercel-build` executa `tsx scripts/migrate.ts && next build`: produção aplica a migration Postgres primeiro; falha aborta o build. O runtime não aplica migrations.
6. **Preview nunca migra**, mesmo com `ALLOW_REMOTE_MIGRATE=1`. A etapa retorna antes de abrir banco e segue para o build. Para um preview funcional, use branch Neon isolada com schema já preparado; não compartilhe URI de produção. Sem conexão válida, o build pode passar, mas páginas que consultam banco falharão no runtime.
7. Fora da Vercel Production, migration remota exige a flag explícita `ALLOW_REMOTE_MIGRATE=1`; nunca em Preview. Isso autoriza somente o migrator, sem habilitar remoto no runtime dev/teste. Não execute contra produção sem autorização do dono.

`npm run db:generate` gera SQL Postgres; `npm run db:migrate` aplica o journal em PGlite local ou no alvo remoto autorizado. Não há backup VACUUM. Para produção, o dono planeja [restauração por ponto no tempo e branches Neon](https://neon.com/docs/introduction/branching) conforme a janela disponível. Os testes confirmam rollback de DDL e journal na falha de migration em PGlite.

O migrator prepara o schema/tabela de controle antes da transação que aplica o lote. Serialize deploys com migrations no mesmo banco. Uma resposta perdida no COMMIT remoto pode deixar o resultado desconhecido: confirme o journal antes de repetir. Reverter o código ou falhar o build não desfaz uma migration já confirmada. Alterações futuras devem ser compatíveis com o código anterior ou ter recuperação planejada. A integração remota não foi executada nesta tarefa.

## Segurança e validação

Autorização por usuário em todas as operações de produto; queries parametrizadas, valores/data/pontos do servidor e texto escapado por React. Ações usam verificação de origem do Next.js e corpo limitado a 32 KB. Falhas retornam mensagens sem credenciais. Ainda é preciso configurar/validar rate limits de login/cadastro no provedor/plataforma; não há limiter distribuído próprio. Login inexistente e senha incorreta compartilham mensagem, mas cadastro e comportamento do provedor ainda podem permitir enumeração de e-mail. Não liberar produção antes do QA remoto autorizado.

`next.config.ts` mantém arquivos `.env*`, dados, `.maestri` e documentação local fora do tracing. Use `npm audit` e `npm audit --omit=dev`. Resultados e limites atuais estão em `VALIDATION-PHASE5.md`; o relatório da portabilidade anterior permanece em `VALIDATION-PHASE7.md`. Navegador é responsabilidade da Lupa pelo portal Maestri; não usar agent-browser.
