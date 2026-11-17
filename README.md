# Rotina Pet

Fase 1: app local individual de gamificação de rotina em Next.js + TypeScript, SQLite local e Drizzle. Cadastre rotinas, adicione atividades e conclua cada uma diariamente para ganhar 10 pontos. O pet fica triste abaixo de 40%, ok de 40% a menos de 70% e feliz a partir de 70%. Sem atividades, fica ok. Conclusões repetidas mostram “Ja concluida hoje” e não geram pontos adicionais.

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
npm start
```

`npm run db:generate` gera SQL versionável a partir de `src/db/schema.ts`. `npm run db:migrate` aplica as migrations somente ao SQLite local e rejeita `NODE_ENV=production` e URLs remotas. O build e a aplicação não executam migrations automaticamente. Nenhum banco de produção foi alterado.

## Regras e persistência

- Conclusões são únicas por atividade e dia no fuso `America/Sao_Paulo`, inclusive sob requisições concorrentes. Pontos são definidos no servidor.
- Pontos acumulam; as atividades voltam a ficar disponíveis no dia seguinte. Atualize a página após a meia-noite para mostrar o novo dia.
- Rotinas, atividades e conclusões ficam no arquivo SQLite, fora do Git. Faça backup com o aplicativo parado. Não há exclusão nem edição nesta fase.
- Não há dados fictícios iniciais. Os testes usam um banco temporário isolado, aplicam as migrations reais e verificam persistência, duplicação, pontos, humor, validação e virada de dia.

## Segurança e limites da fase

Esta versão não tem autenticação nem isolamento entre usuários. Todas as pessoas com acesso ao servidor compartilham os dados e podem alterá-los. `dev` e `start` escutam apenas em `127.0.0.1`. Não publique nem exponha à rede sem adicionar autenticação, autorização por usuário e limites de requisições.

As Server Actions usam POST e a proteção de origem do Next.js; nomes e IDs são validados no servidor, consultas usam parâmetros do Drizzle e textos são escapados pelo React. O limite de corpo das ações é 32 KB. Não há credenciais necessárias ou versionadas. `.env`, bancos, dependências, builds e `.maestri/` ficam ignorados.

Verifique dependências com `npm audit` e `npm audit --omit=dev`. O resultado da auditoria da entrega está em `VALIDATION.md`.

Referências de implementação: [Next.js](https://nextjs.org/docs/app/getting-started/installation) e [Drizzle com SQLite/libSQL](https://orm.drizzle.team/docs/get-started/sqlite-new).
