# Fase 6 — preparação de deploy

Escopo: preparar Vercel + Turso, sem push, recursos externos ou migration remota executada. A base recebeu o commit `7fa9c25` do Farol antes de editar `scripts/migrate.ts`; backup local somente com pendência, retenção de cinco cópias e abortar na falha foram preservados. `tests/gamification.test.ts` não faz parte das alterações desta fase.

## Configuração e política

- Runtime dev/teste continua em SQLite dentro do projeto, inclusive com proteção contra traversal, links, percent-encoding e caminhos ambíguos. Token residual não é enviado ao driver local.
- `libsql://` exige token não vazio e `VERCEL` definido ou `NODE_ENV=production`. URLs com credenciais, parâmetros, fragmentos, espaços ou caminhos são recusadas. Na Vercel, configuração ausente ou SQLite em arquivo não fazem fallback silencioso.
- A factory recebe URL e `authToken` separados. Testes usam factory substituída por cliente em memória, sem tráfego remoto. Erros de configuração não mostram os dados de conexão; exceções do driver durante migration remota são substituídas por mensagem genérica.
- `vercel-build` é `tsx scripts/migrate.ts && next build`. Em Production migra libsql antes de construir. Preview retorna da etapa de migration antes de abrir qualquer banco, inclusive com override. `ALLOW_REMOTE_MIGRATE=1` libera somente migration manual fora de Preview e não altera a regra do runtime dev/teste.
- Nenhum `VACUUM` ou backup em arquivo é executado para remoto. PITR/branch do Turso são responsabilidade operacional do dono/maestro, conforme README.
- `vercel.json`: `gru1`, `npm run vercel-build`. Deployment Protection deve ser configurada externamente com All Deployments e acesso só do dono; Standard Protection não protege o domínio de produção.

## Transações: confirmação e limites

Conferido no código instalado: `@libsql/core` converte libsql para HTTPS; Drizzle prepara/lê `__drizzle_migrations` antes do lote; `libsql/session` chama `client.migrate`; o driver HTTP chama `executeHranaBatch` em modo deferred, desliga foreign keys para o lote, faz COMMIT condicionado e solicita ROLLBACK em erro. A [API oficial](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html#migrate) documenta esse comportamento.

Não houve teste de transação em serviço remoto. Queda de rede no COMMIT pode tornar o resultado desconhecido; checar journal antes de repetir. Preparação do journal não pertence à mesma transação, e não há lock distribuído entre dois deploys que detectem a mesma pendência. Serialize deploys com migrations e prefira schema compatível com a versão anterior. Falha do build após uma migration confirmada não reverte o banco. Ver [PITR](https://docs.turso.tech/features/point-in-time-recovery) e [branching](https://docs.turso.tech/features/branching).

## Verificações

- `npm test`: **50 testes verdes, 0 falhas**. Nove testes novos de política/configuração em `tests/deploy-policy.test.ts`; duas expectativas antigas foram ajustadas para a nova mensagem de bloqueio remoto. Os quatro testes de backup do Farol continuam aprovados.
- `npm run build`: aprovado, **sem os dois avisos de tracing**. As guardas locais continuaram aprovadas após as anotações de tracing.
- `npm run typecheck`: aprovado.
- `VERCEL_ENV=preview npm run vercel-build`: aprovado; a etapa de migration retornou antes de abrir banco. Foi usada uma URL local inválida fora do projeto para comprovar que a configuração não foi aberta durante esse caminho de build.
- `git diff --check`: aprovado antes do commit.
- `.env.example`: duas variáveis vazias, sem segredo. Nenhuma dependência ou lockfile alterado.

Nenhuma conexão/migration remota foi executada: permissões remotas são verificadas por política pura e factory substituída; subprocessos remotos são somente os casos bloqueados/Preview, que encerram antes de abrir conexão. O caminho local conserva os testes de backup do Farol. O fluxo autorizado de produção está ligado ao migrator real por código, mas sua execução contra o serviço fica para o maestro após configurar os recursos.

## Riscos e auditoria

- `npm audit --omit=dev`: **0 vulnerabilidades reportadas**. Auditoria completa: **4 moderadas preexistentes** na cadeia Drizzle Kit/esbuild (GHSA-67mh-4wv8-2f99), sem mudança de dependências.
- A proteção de acesso e o vínculo Git/main precisam ser configurados no painel. Sem All Deployments, produção pode ficar pública. Não há autorização por usuário ou rate limiting no app.
- Token de produção deve ficar apenas no servidor e no escopo Production. Preview deve usar banco/branch separado já preparado; o build não migra seu schema.
- Riscos de journal fora da transação, concorrência de deploys, COMMIT remoto com resultado desconhecido e rollback de código sem rollback de banco estão detalhados no README, com fontes primárias. Nenhuma garantia de integração remota testada é declarada.

## Arquivos próprios

`.env.example`, `package.json`, `next.config.ts`, `vercel.json`, `src/db/client.ts`, `src/db/migration-policy.ts`, `scripts/migrate.ts`, `tests/deploy-policy.test.ts`, `tests/db-guard.test.ts`, `tests/schedule.test.ts`, `README.md`, `PRODUCT.md`, `VALIDATION-PHASE6.md`.

Não houve agent-browser nem interação com painel Vercel/Turso. Alterações concorrentes em pet/CSS e `.impeccable/config.json` ficaram fora do escopo deste commit.
