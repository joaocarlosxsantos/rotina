# Rotina Pet

Fase 2: app local individual de gamificação de rotina em Next.js + TypeScript, SQLite local e Drizzle. Cadastre rotinas, adicione atividades e conclua cada uma diariamente para ganhar 10 pontos. O pet fica triste abaixo de 40%, ok de 40% a menos de 70% e feliz a partir de 70%. Sem atividades previstas, fica ok. Conclusões repetidas mostram “Ja concluida hoje” e não geram pontos adicionais.

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

`npm run db:generate` gera SQL versionável a partir de `src/db/schema.ts`. `npm run db:migrate` aplica as migrations somente ao SQLite local e rejeita `NODE_ENV=production` e URLs remotas. O build e a aplicação não executam migrations automaticamente. Nenhum banco de produção foi alterado.

## Regras e persistência

- Conclusões são únicas por atividade e dia no fuso `America/Sao_Paulo`, inclusive sob requisições concorrentes. Pontos são definidos no servidor.
- Pontos acumulam; as atividades voltam a ficar disponíveis no dia seguinte. Atualize a página após a meia-noite para mostrar o novo dia.
- Rotinas, atividades e conclusões ficam no arquivo SQLite, fora do Git. Faça backup com o aplicativo parado. Edição mantém os mesmos IDs e conclusões. Arquivamento oculta itens, sem apagar linhas ou pontos. Não há exclusão nem restauração pela interface nesta fase.
- Em `/rotinas`, edite nome e dias da rotina, nome e horário da atividade e confirme arquivamentos. A rotina exige pelo menos um dia de 0 (domingo) a 6 (sábado); as atividades herdam esses dias. O horário é opcional, estritamente HH:MM entre 00:00 e 23:59 e serve de referência em São Paulo, sem bloquear conclusão antecipada.
- A página `/` mostra apenas rotinas ativas previstas para o dia civil de São Paulo e suas atividades ativas. Progresso e humor consideram somente essas atividades; o total de pontos inclui o histórico arquivado. Itens de outros dias continuam acessíveis em Gerenciar rotinas.
- A migration `0001` acrescenta agenda e arquivamento; rotinas da Fase 1 ficam previstas para todos os dias, atividades antigas permanecem sem horário, dados e conclusões são preservados. Não há penalidade por pular ou bônus de sequência (Fase 3).
- Não há dados fictícios iniciais. Os testes usam um banco temporário isolado, aplicam as migrations reais e verificam persistência, duplicação, pontos, humor, validação e virada de dia.

## Segurança e limites da fase

Esta versão não tem autenticação nem isolamento entre usuários. Todas as pessoas com acesso ao servidor compartilham os dados e podem alterá-los. `dev` e `start` escutam apenas em `127.0.0.1`. Não publique nem exponha à rede sem adicionar autenticação, autorização por usuário e limites de requisições.

As Server Actions usam POST e a proteção de origem do Next.js; nomes (2–80), UUIDs v4, dias e horários são validados no servidor, consultas usam parâmetros do Drizzle e textos são escapados pelo React. Criar e concluir atividades verificam agenda/arquivamento na própria escrita SQL. Itens arquivados ou fora da agenda de hoje não recebem novas conclusões; editar e adicionar sob rotina arquivada também é bloqueado. O destino de retorno das ações é limitado a `/` ou `/rotinas`. O limite de corpo das ações é 32 KB. Não há credenciais necessárias ou versionadas. `.env`, bancos, dependências, builds e `.maestri/` ficam ignorados.

Verifique dependências com `npm audit` e `npm audit --omit=dev`. A validação da Fase 1 está em `VALIDATION.md`; testes, auditoria e limites da Fase 2 estão em `VALIDATION-PHASE2.md`.

Referências de implementação: [Next.js](https://nextjs.org/docs/app/getting-started/installation) e [Drizzle com SQLite/libSQL](https://orm.drizzle.team/docs/get-started/sqlite-new).
