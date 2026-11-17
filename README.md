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

`npm run db:generate` gera SQL versionável a partir de `src/db/schema.ts`. `npm run db:migrate` cria primeiro um backup SQLite consistente no mesmo diretório do banco (`*.backup-*.db`), então aplica as migrations somente ao SQLite local dentro do projeto. Rejeita `NODE_ENV=production`, URLs remotas e caminhos fora do projeto; falha no backup interrompe a migration. O build e a aplicação não executam migrations automaticamente. Nenhum banco de produção foi alterado.

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

Esta versão não tem autenticação nem isolamento entre usuários. Todas as pessoas com acesso ao servidor compartilham os dados e podem alterá-los. `dev` e `start` escutam apenas em `127.0.0.1`. Não publique nem exponha à rede sem adicionar autenticação, autorização por usuário e limites de requisições.

As Server Actions usam POST e a proteção de origem do Next.js; nomes (2–80), UUIDs v4, dias e horários são validados no servidor, consultas usam parâmetros do Drizzle e textos são escapados pelo React. Criar e concluir atividades verificam agenda/arquivamento na própria escrita SQL. Itens arquivados ou fora da agenda de hoje não recebem novas conclusões; editar e adicionar sob rotina arquivada também é bloqueado. O destino de retorno das ações é limitado a `/` ou `/rotinas`. O limite de corpo das ações é 32 KB. Não há credenciais necessárias ou versionadas. `.env`, bancos, dependências, builds e `.maestri/` ficam ignorados.

Verifique dependências com `npm audit` e `npm audit --omit=dev`. As validações estão em `VALIDATION.md`, `VALIDATION-PHASE2.md` e `VALIDATION-PHASE3.md`. Navegador é validado pela Lupa pelo portal Maestri; não usar agent-browser.

Referências de implementação: [Next.js](https://nextjs.org/docs/app/getting-started/installation) e [Drizzle com SQLite/libSQL](https://orm.drizzle.team/docs/get-started/sqlite-new).
