# Validação da Fase 3 — gamificação

Base recebida: `b8482dd`. Nenhuma dependência adicionada. Sem push e sem migration em produção. Não foi usado agent-browser; a validação de navegador pertence à Lupa pelo portal Maestri.

## Comportamento entregue

- Concluir e pular usam a mesma linha diária e o mesmo índice único por atividade/dia SP. Repetir é idempotente; tentar a outra ação é rejeitado. Ambas verificam UUID v4, item ativo, pai ativo e agenda na própria escrita SQL.
- Concluir rende +10 e bônus de `min(sequência incluindo hoje - 1, 5)`, uma vez por conclusão. Várias conclusões do mesmo dia têm o mesmo bônus, sem aumentar o número de dias da sequência.
- Pular registra -5 nominais e desconta no máximo o saldo disponível. O piso zero é aplicado em cada lançamento, sem dívida futura. Dia apenas com pulos não conta para a sequência; pular não remove conclusões existentes.
- Cada lançamento calcula saldo, bônus e ordem dentro de uma única instrução INSERT, com parâmetros. O índice de ordem também é único. Nenhum valor de pontos/bônus/data é aceito do formulário.
- A sequência atual ancora em hoje se já houve conclusão, ou ontem enquanto hoje ainda está aberto. Um dia civil sem conclusão quebra a sequência, inclusive se não havia agenda.
- UI inclui Pular (-5), estado Pulada, sequência atual e os últimos 30 lançamentos com data, atividade, pontos base, bônus e saldo. Durante submissão as duas ações ficam desabilitadas; o servidor continua sendo a autoridade para concorrência e idempotência.
- Humor preservado: menos de 40% triste, 40% a menos de 70% ok, 70% ou mais feliz. Puladas não contam como concluídas, mas permanecem no denominador das atividades previstas e ativas.
- `PRODUCT.md` documenta as regras e casos de fronteira. `README.md` corrige “Já concluída hoje” e descreve o backup e a Fase 3. `DESIGN.md` e `.impeccable/design.json` documentam os novos controles e estados sem reivindicar validação de navegador.

## Verificação final

- `npm test`: **30 testes verdes, 0 falhas**, incluindo 11 novos testes em `tests/gamification.test.ts` e atualização de duas expectativas antigas para +1 de bônus no segundo dia consecutivo.
- `npm run build`: aprovado, com os dois avisos preexistentes de tracing dinâmico em `src/db/client.ts`. Esses avisos podem ampliar os arquivos incluídos em pacote de implantação; não houve implantação ou alteração desse arquivo nesta fase.
- `npm run typecheck`: aprovado.
- `git diff --check`: verificado antes do commit.
- Detector mecânico de design: somente advisories de escala tipográfica em `globals.css`; nenhuma validação de navegador foi executada nesta fase.

Testes novos cobrem: penalidade e piso zero sem dívida, exclusividade concluir/pular, pulos e conclusões repetidos em Promise.all, várias atividades concorrentes sem perda de saldo, sequência com dias distintos e teto de bônus, dia apenas com pulos, reset após lacuna, virada 02:59Z/03:00Z, UUID/arquivamento/agenda inválidos, calendário com mudança de ano e ano bissexto, migration com múltiplas conclusões legadas e criação do backup antes da migration.

## Migration e backup

Migration gerada pelo Drizzle: `0002_mushy_nocturne.sql`, com campos `status`, `bonus`, `event_order` e `balance_after` na tabela existente. O SQL foi complementado com o preenchimento das linhas antigas **antes** da criação do índice único de ordem. As conclusões antigas permanecem +10, bônus zero, ordem de inserção e saldo acumulado preservados. Não há bônus retroativo; os dias antigos contam para a sequência futura.

Aplicada somente ao SQLite local padrão (`data/rotina.db`). Antes de aplicar, `scripts/migrate.ts` executou `VACUUM INTO ?` para um arquivo irmão `*.backup-*.db`. Isso gera snapshot consistente inclusive com WAL; falha no backup impede migrar. O script continua rejeitando `NODE_ENV=production`, URL remota e caminho fora do projeto antes de abrir o banco. O teste de backup roda em SQLite local temporário isolado; demais testes usam memória ou arquivos temporários, sem afetar o banco da aplicação.

## Segurança e pendências

- `npm audit --omit=dev`: **0 vulnerabilidades reportadas**.
- `npm audit`: **4 moderadas já existentes** na cadeia Drizzle Kit/esbuild, GHSA-67mh-4wv8-2f99. Não houve alteração de dependências nem correção automática que rebaixasse Drizzle Kit.
- Sem autenticação, autorização por usuário ou rate limiting: a aplicação continua restrita a localhost e uso individual. Consultas parametrizadas, textos escapados por React e proteção de origem/limite de corpo do Next.js preservados.
- Arquivos de banco, backups, `.env`, dependências e builds não entram no commit. A configuração local `.impeccable/config.json`, já não rastreada na base, foi preservada fora do commit.
- Revisão visual e interações reais de navegador ficam para a Lupa. Não há relatório de navegador desta fase.

## Arquivos desta entrega

`src/db/schema.ts`, `src/lib/store.ts`, `src/lib/rules.ts`, `src/app/actions.ts`, `src/app/page.tsx`, `src/app/submit.tsx`, `src/app/globals.css`, `scripts/migrate.ts`, `tests/gamification.test.ts`, `tests/routine.test.ts`, `tests/schedule.test.ts`, `drizzle/0002_mushy_nocturne.sql`, `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json`, `PRODUCT.md`, `README.md`, `DESIGN.md`, `.impeccable/design.json`, `VALIDATION-PHASE3.md`.
