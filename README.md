# Rotina Pet — Postgres

Next.js + TypeScript + Drizzle. Produção usa Neon Postgres; desenvolvimento e testes usam PGlite (Postgres embarcado, sem Docker). Login e isolamento por usuário ainda não estão implementados: pertencem à futura Fase 5. Até lá os dados e pontos são globais, e a produção deve continuar acessível apenas ao dono por Vercel Deployment Protection.

## Rodar localmente

Requer **Node.js 22+**. O runtime Neon usa o WebSocket nativo do Node; não requer dependência `ws` adicional.

```powershell
npm ci
npm run db:migrate
npm run dev
```

Abra http://127.0.0.1:3000. Sem variáveis de banco, o padrão é PGlite em `data/pglite`. Para outro diretório dentro do projeto, use `$env:DATABASE_URL='pglite:./data/outro-pg'`. Para testes efêmeros, `memory://`. Caminhos fora do projeto, traversal, links que escapem do projeto, URL de rede e formatos inválidos são recusados. Execute migrations locais com o servidor parado: PGlite não é um servidor de banco para múltiplos processos abrirem o mesmo diretório simultaneamente.

App e scripts leem o ambiente do processo. Next.js também carrega `.env`; os scripts não carregam esse arquivo automaticamente. `.env.example` contém somente nomes vazios. Não use URI de produção no desenvolvimento: dev/teste recusam conexão remota, e produção/Vercel recusam PGlite e configuração ausente.

**Dados locais SQLite anteriores não são importados.** As migrations 0000–0002 antigas foram substituídas por uma única migration inicial Postgres. Não há dados de produção a preservar; os arquivos SQLite locais antigos podem ser descartados pelo dono. Esta tarefa não apagou arquivos de dados em `data/`. O app passa a usar outro diretório, `data/pglite`.

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

Lançamentos usam transação **READ COMMITTED**. A primeira instrução obtém `pg_advisory_xact_lock(724681, 1)`; só depois lê saldo, sequência e resolução do dia. O lock é global porque ainda não há login; a futura fase de usuários deverá vinculá-lo ao usuário e particionar saldo/histórico. Leituras de rotina e atividade usam `FOR SHARE` na transação, impedindo arquivamento concorrente de invalidar a decisão. Os índices únicos e checks do banco continuam sendo a defesa final.

Neon usa `@neondatabase/serverless` com Pool WebSocket e `drizzle-orm/neon-serverless`, que suportam transações interativas. PGlite usa `drizzle-orm/pglite`, com o mesmo schema `pg-core`. Não há cálculo de saldo fora da transação nem dependência de SQL de outro motor. Referências: [Drizzle + Neon](https://orm.drizzle.team/docs/connect-neon), [transações Drizzle](https://orm.drizzle.team/docs/transactions), [locks Postgres](https://www.postgresql.org/docs/current/explicit-locking.html) e [PGlite](https://pglite.dev/docs/api).

## Deploy Vercel + Neon — maestro/dono

Esta tarefa não faz push, cria recursos ou executa migration remota.

1. Na Vercel, **Storage > Neon > conectar ao projeto em Production**. A integração fornece a conexão Postgres; o app aceita `DATABASE_URL` e, na ausência dela, `POSTGRES_URL`. Use a URI padrão Neon (`postgres://` ou `postgresql://`, host `*.neon.tech`, usuário, senha e nome do banco). Senhas ficam somente no ambiente sensível do servidor, nunca em `NEXT_PUBLIC_*` ou no Git. [Integração oficial](https://neon.com/docs/guides/vercel-managed-integration).
2. Mantenha `DATABASE_URL_UNPOOLED` se fornecida: migrations a preferem a `DATABASE_URL`/`POSTGRES_URL`; o runtime não a usa. URI de conexão, senha ou token nunca são escritos em logs ou erros próprios. TLS desativado e parâmetros que substituam host/credenciais são rejeitados.
3. Configure Node.js 22+ e mantenha as dependências de desenvolvimento durante o build (o migrator usa `tsx`). `vercel.json` mantém região `gru1` e `npm run vercel-build`. Configure `main` como branch de produção. O push e a ativação da integração Git são feitos pelo maestro quando autorizados.
4. Habilite **All Deployments + Vercel Authentication** e conceda acesso só ao dono enquanto o login não existir. Standard Protection deixa o domínio de produção público. Valide os domínios e URLs geradas em acesso anônimo antes de liberar. [Deployment Protection](https://vercel.com/docs/deployment-protection).
5. Garanta que as variáveis de sistema exponham `VERCEL` e `VERCEL_ENV=production` ao build. `vercel-build` executa `tsx scripts/migrate.ts && next build`: produção aplica a migration Postgres primeiro; falha aborta o build. O runtime não aplica migrations.
6. **Preview nunca migra**, mesmo com `ALLOW_REMOTE_MIGRATE=1`. A etapa retorna antes de abrir banco e segue para o build. Para um preview funcional, use branch Neon isolada com schema já preparado; não compartilhe URI de produção. Sem conexão válida, o build pode passar, mas páginas que consultam banco falharão no runtime.
7. Fora da Vercel Production, migration remota exige a flag explícita `ALLOW_REMOTE_MIGRATE=1`; nunca em Preview. Isso autoriza somente o migrator, sem habilitar remoto no runtime dev/teste. Não execute contra produção sem autorização do dono.

`npm run db:generate` gera SQL Postgres; `npm run db:migrate` aplica o journal em PGlite local ou no alvo remoto autorizado. Não há backup VACUUM. Para produção, o dono planeja [restauração por ponto no tempo e branches Neon](https://neon.com/docs/introduction/branching) conforme a janela disponível. Os testes confirmam rollback de DDL e journal na falha de migration em PGlite.

O migrator prepara o schema/tabela de controle antes da transação que aplica o lote. Serialize deploys com migrations no mesmo banco. Uma resposta perdida no COMMIT remoto pode deixar o resultado desconhecido: confirme o journal antes de repetir. Reverter o código ou falhar o build não desfaz uma migration já confirmada. Alterações futuras devem ser compatíveis com o código anterior ou ter recuperação planejada. A integração remota não foi executada nesta tarefa.

## Segurança e validação

Sem login, autorização por usuário ou rate limiting dentro do app. Deployment Protection continua obrigatória e não substitui a implementação futura de isolamento de dados. Queries são parametrizadas; valores, data e pontos são definidos no servidor; texto é escapado por React. Ações usam verificação de origem do Next.js e corpo limitado a 32 KB. Falhas de configuração e migration retornam mensagens sem credenciais.

`next.config.ts` mantém arquivos `.env*`, dados, `.maestri` e documentação local fora do tracing. Use `npm audit` e `npm audit --omit=dev`. Resultados, arquivos e limites desta entrega estão em `VALIDATION-PHASE7.md`. Navegador é responsabilidade da Lupa pelo portal Maestri; não usar agent-browser.
