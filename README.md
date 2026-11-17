# Rotina Pet

Fase 3: app local individual de gamificação de rotina em Next.js + TypeScript, SQLite local e Drizzle. Conclua atividades para ganhar +10 pontos e bônus de sequência de até +5 por conclusão, ou use Pular para descontar -5, com saldo mínimo zero. O pet fica triste abaixo de 40%, ok de 40% a menos de 70% e feliz a partir de 70%. Sem atividades previstas, fica ok. Conclusões repetidas mostram “Já concluída hoje” e não geram pontos adicionais.

## Executar localmente

Requer Node.js 22 ou superior e npm. Na raiz do projeto:

```powershell
npm ci
# Opcional: copie .env.example para .env e ajuste o caminho local.
npm run db:migrate
npm run dev
```

Abra http://127.0.0.1:3000. O padrão é `file:./data/rotina.db`; não exige `.env`. Next.js lê `.env` automaticamente. Os scripts de banco leem `DATABASE_URL` do ambiente do processo; se quiser personalizá-lo no PowerShell, use `$env:DATABASE_URL='file:./data/outro.db'` antes de executá-los. Use o mesmo valor no app e nas migrations.

```powershell
npm test
npm run build
npm run typecheck
npm start
```

`npm run db:generate` gera SQL versionável a partir de `src/db/schema.ts`. Em SQLite local, `npm run db:migrate` cria backup consistente (`*.backup-*.db`) apenas com migration pendente, mantém os cinco mais recentes e aborta se o backup falhar. Arquivos fora do projeto e SQLite local com `NODE_ENV=production` continuam bloqueados. A política de migrations remotas está no passo a passo de deploy abaixo. `npm run build` e o runtime não aplicam migrations; `npm run vercel-build` aplica somente no deploy de produção. Nenhuma migration remota foi executada durante esta implementação.

## Regras e persistência

- Concluir e pular disputam o mesmo registro único por atividade/dia SP, inclusive em requisições concorrentes. Repetir a ação não repete pontos; tentar a ação oposta é rejeitado. Valores são definidos no servidor.
- Pular desconta -5 pontos, limitado ao saldo disponível, sem gerar dívida. O histórico preserva -5 nominais e o saldo após o desconto. Não há pulo automático para atividades não resolvidas.
- A sequência conta dias corridos com pelo menos uma conclusão. Cada conclusão recebe `min(sequência incluindo hoje - 1, 5)` de bônus: +0 no primeiro dia, +1 no segundo, até +5 no sexto e seguintes. Várias conclusões do mesmo dia não aumentam os dias da sequência, mas cada uma recebe seu bônus uma vez.
- Pular não apaga a sequência; dia inteiro sem conclusão a quebra. Antes da primeira conclusão de hoje, a sequência atual ainda mostra os dias consecutivos até ontem. Hoje exibe sequência atual e os últimos 30 lançamentos com pontos base, bônus, penalidade e saldo. As regras completas estão em `PRODUCT.md`.
- Pontos acumulam; as atividades voltam a ficar disponíveis no dia seguinte. Atualize a página após a meia-noite para mostrar o novo dia.
- Rotinas, atividades e conclusões ficam no arquivo SQLite, fora do Git. Faça backup com o aplicativo parado. Edição mantém os mesmos IDs e conclusões. Arquivamento oculta itens, sem apagar linhas ou pontos. Não há exclusão nem restauração pela interface nesta fase.
- Em `/rotinas`, edite nome e dias da rotina, nome e horário da atividade e confirme arquivamentos. A rotina exige pelo menos um dia de 0 (domingo) a 6 (sábado); as atividades herdam esses dias. O horário é opcional, estritamente HH:MM entre 00:00 e 23:59 e serve de referência em São Paulo, sem bloquear conclusão antecipada.
- A página `/` mostra apenas rotinas ativas previstas para o dia civil de São Paulo e suas atividades ativas. Progresso e humor consideram somente essas atividades; o total de pontos inclui o histórico arquivado. Itens de outros dias continuam acessíveis em Gerenciar rotinas.
- A migration `0001` acrescenta agenda e arquivamento; a `0002` registra conclusão/pulo, bônus, ordem e saldo. Dados antigos são preservados com bônus zero, sem recompensas retroativas; conclusões antigas contam para a sequência futura.
- Não há dados fictícios iniciais. Os testes usam um banco temporário isolado, aplicam as migrations reais e verificam persistência, duplicação, pontos, humor, validação e virada de dia.

## Segurança e limites da fase

Esta versão não tem autenticação nem isolamento por usuário dentro do app. Todas as pessoas que alcançam o servidor compartilham e alteram os mesmos dados. Localmente, `dev` e `start` escutam apenas em `127.0.0.1`. Na Vercel, a decisão do dono é restringir o acesso por Deployment Protection a ele; essa configuração externa é obrigatória antes de liberar a produção. Não há rate limiting no app.

As Server Actions usam POST e a proteção de origem do Next.js; nomes (2–80), UUIDs v4, dias e horários são validados no servidor, consultas usam parâmetros do Drizzle e textos são escapados pelo React. Criar e concluir atividades verificam agenda/arquivamento na própria escrita SQL. Itens arquivados ou fora da agenda de hoje não recebem novas conclusões; editar e adicionar sob rotina arquivada também é bloqueado. O destino de retorno das ações é limitado a `/` ou `/rotinas`. O limite de corpo das ações é 32 KB. Localmente não é necessário token; para Turso, `DATABASE_AUTH_TOKEN` é obrigatório e fica apenas no ambiente do servidor, nunca com prefixo `NEXT_PUBLIC_`. `.env`, bancos, dependências, builds e `.maestri/` ficam ignorados. Não registre token ou URL completa em logs.

## Deploy Vercel + Turso — execução pelo maestro/dono

Este repositório prepara o deploy; esta tarefa não criou recursos, não fez push e não acessou banco remoto. O maestro/dono executa os passos abaixo.

1. Prepare o banco Turso e um token com permissão para o app e migrations. Guarde-os fora do Git. Antes de uma alteração de schema, confirme a janela de recuperação PITR disponível e, se necessário, prepare uma branch/cópia. O remoto não usa `VACUUM INTO`: recuperação e branching são recursos do Turso. Consulte [PITR](https://docs.turso.tech/features/point-in-time-recovery) e [branching](https://docs.turso.tech/features/branching).
2. Importe o repositório na Vercel, com framework Next.js, diretório raiz do projeto e Node.js 22 ou superior suportado pela plataforma. Configure `main` como branch de produção. O projeto usa `vercel.json` com região `gru1` (São Paulo) e comando `npm run vercel-build`. Mantenha dependências de desenvolvimento no build: `tsx` é necessário para o migrator.
3. Configure as variáveis **Production**, disponíveis no build e no runtime: `DATABASE_URL` com a URL `libsql://` do banco e `DATABASE_AUTH_TOKEN` com seu token, como dado sensível. Ative a exposição das System Environment Variables e confirme `VERCEL_ENV=production` no build; sem esse indicador, `vercel-build` ignora migrations. Não coloque valores em `.env.example` nem em código. Na Vercel, SQLite em arquivo ou ausência de configuração falham de forma explícita. Fora da Vercel, libsql só é aceito com `NODE_ENV=production`; dev/teste continuam com SQLite em arquivo restrito ao projeto.
4. Configure Deployment Protection com **All Deployments + Vercel Authentication**, protegendo também domínio de produção e URLs geradas. **Standard Protection deixa o domínio de produção aberto**. Para acesso só do dono, não conceda acesso ao projeto para terceiros nem distribua bypass links/tokens. Verifique o acesso anônimo e por outra conta antes de liberar. A proteção é configurada no painel, não por este `vercel.json`. Veja [Deployment Protection](https://vercel.com/docs/deployment-protection).
5. Quando autorizado pelo dono, faça push em `main`; a integração Git da Vercel inicia o deploy. `vercel-build` executa `tsx scripts/migrate.ts && next build`. Com `VERCEL_ENV=production`, o migrator exige libsql + token e migra antes do build; falha impede o build. O runtime não migra.
6. Preview nunca executa migration, mesmo com `ALLOW_REMOTE_MIGRATE=1`. A etapa retorna sem abrir banco e segue para `next build`. Não forneça o token de produção para Preview. Para previews funcionais, use um banco/branch separado já com schema preparado e sua credencial própria; sem configuração o build pode passar, mas as páginas que usam banco falham ao acessar o runtime. Preview não prepara schema automaticamente.
7. Migração remota manual fora de deploy requer `ALLOW_REMOTE_MIGRATE=1`, URL e token no ambiente, e ausência de `VERCEL_ENV=preview`. Esse override autoriza só o migrator, não o runtime dev/teste. Nunca rode isso contra produção sem autorização do dono. Migrations locais continuam com a guarda e backup do Farol.

### Transação remota e riscos operacionais

Inspecionado em `@libsql/client@0.18.0` e `drizzle-orm@0.45.4`: `libsql://` é convertido para transporte HTTPS. Drizzle prepara a tabela de journal e lê a última migration antes de chamar `client.migrate()` com SQL pendente e seus registros. O cliente HTTP/Hrana executa esse lote em transação **deferred**, com foreign keys desativadas durante o lote, COMMIT condicionado ao sucesso e ROLLBACK em erro. A [API oficial de Client.migrate](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html#migrate) confirma a atomicidade do lote. Isso foi confirmado por código e documentação, sem executar em Turso.

A preparação/leitura do journal fica fora do lote. Deploys simultâneos podem observar a mesma migration pendente: serialize alterações de schema para um mesmo banco. Uma falha de rede na resposta ao COMMIT pode deixar o resultado desconhecido; confirme o journal/estado antes de repetir. Uma migration já confirmada não é desfeita se `next build` falhar ou se o código for revertido. Prefira alterações compatíveis com a versão anterior e planeje recuperação via Turso; PITR/branch não são criados automaticamente por este script. Erros remotos do migrator são redigidos para não mostrar URL, token nem causa bruta do driver.

O `next.config.ts` exclui `.env*`, `data`, `.maestri` e `.impeccable` do tracing de funções. Anotações `turbopackIgnore` impedem a inclusão dinâmica do projeto inteiro sem remover a validação de caminho local. Referências: [variáveis Vercel](https://vercel.com/docs/environment-variables/system-environment-variables), [builds Git](https://vercel.com/docs/builds) e [regiões](https://vercel.com/docs/regions).

Verifique dependências com `npm audit` e `npm audit --omit=dev`. As validações estão em `VALIDATION.md`, `VALIDATION-PHASE2.md` e `VALIDATION-PHASE3.md`. Navegador é validado pela Lupa pelo portal Maestri; não usar agent-browser.

Referências de implementação: [Next.js](https://nextjs.org/docs/app/getting-started/installation) e [Drizzle com SQLite/libSQL](https://orm.drizzle.team/docs/get-started/sqlite-new).
