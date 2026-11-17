# Validação da Fase 2

## Entrega e critérios

- Rotinas: editar nome e dias; arquivar sem apagar. Atividades: editar nome e horário opcional; arquivar sem apagar. A gestão em `/rotinas` alcança itens de qualquer dia e permite consultar arquivados.
- Hoje: rotinas ativas com o dia da semana de São Paulo selecionado e somente suas atividades ativas. Atividades herdam os dias da rotina. Horários são referências opcionais em São Paulo, não bloqueiam conclusão antecipada. Agenda, arquivamento e unicidade são verificados na própria escrita de conclusão.
- Nomes de 2 a 80 caracteres, UUIDs v4, pelo menos um dia inteiro de 0 a 6 e horário estrito HH:MM entre 00:00 e 23:59 são validados no servidor. Também são rejeitadas quebras de linha finais em UUID, dia e horário.
- Arquivamento preserva IDs, linhas, conclusões e pontos; filhos de rotina arquivada ficam indisponíveis. Não há restauração pela interface. Sem penalidade por pular e sem bônus de sequência.
- Nenhuma dependência adicionada. Não houve push.

## Testes e build

- `npm test`: **19 testes aprovados, 0 falhas**. Inclui os testes da Fase 2, os testes existentes de regras, persistência e segurança de DATABASE_URL, concorrência de conclusão com uma única gravação e virada 02:59Z/03:00Z em `completeActivity`.
- Novos testes: validação dos dias, horários, virada semanal em São Paulo, concorrência de conclusão com uma única gravação, virada 02:59Z/03:00Z por `completeActivity`, filtro diário e ordenação, edição preservando histórico, arquivamento preservando linhas/pontos e bloqueando mutações, entradas inválidas, migração incremental a partir do schema da Fase 1 e bloqueio do script de migration em produção/URL remota.
- `npm run build`: aprovado, com dois avisos de tracing dinâmico em `src/db/client.ts`, introduzidos pelos commits de segurança integrados durante esta tarefa. O tracing pode ampliar arquivos incluídos em um pacote de implantação. Não houve implantação; o código de segurança de outro agente foi preservado.
- `npm run typecheck`: aprovado.
- `git diff --check`: aprovado antes do commit.

## Migration e banco

Migration Drizzle gerada: `drizzle/0001_sudden_trauma.sql`. Adiciona `weekdays` (padrão 127: todos os dias) e `archived_at` nas rotinas, `scheduled_time` e `archived_at` nas atividades. Não remove dados ou tabelas.

Aplicada somente aos arquivos SQLite locais em `data/`, incluindo o banco de QA isolado. Uma cópia do SQLite local foi preservada em `data/rotina-before-phase2-*.db` antes da migration. Os bancos e a cópia estão ignorados pelo Git. Nenhuma migration em produção. O teste incremental verifica preservação dos dados legados e repetição idempotente do migrator.

## Rollback

Para restaurar o SQLite anterior à Fase 2 (PowerShell, na raiz do projeto):

1. Encerre o servidor e qualquer script que esteja com o banco aberto.
2. Liste a cópia preservada: `Get-ChildItem -LiteralPath data -Filter 'rotina-before-phase2-*.db'`.
3. Opcional, guarde o estado atual: `Copy-Item -LiteralPath 'data\rotina.db' -Destination 'data\rotina-after-phase2.db'`.
4. Restaure o backup escolhido: `Copy-Item -LiteralPath 'data\rotina-before-phase2-<timestamp>.db' -Destination 'data\rotina.db' -Force`. Se o app usar `DATABASE_URL` customizado, substitua também o arquivo apontado por essa variável; para o banco de QA, use `data\qa-phase2.db` como destino.
5. Volte o código ao commit anterior à Fase 2 (ou aplique `git revert` do commit da Fase 2). Não rode `npm run db:migrate` depois do restore: a migration `0001_sudden_trauma.sql` reaplicaria `weekdays`, `archived_at` e `scheduled_time`.
6. Reabra o app e confirme rotinas, atividades e pontos. Mantenha `data/rotina-before-phase2-*.db` intacto como evidência.

## Navegador e documentação visual

Servidor do build em `127.0.0.1:3001`, com banco local isolado `data/qa-phase2.db`. Fluxo verificado: criar rotina/atividade, concluir, editar rotina e dias, ocultar de Hoje ao mudar para domingo, editar atividade, arquivar atividade e rotina, consultar arquivados e manter os 10 pontos históricos. Um horário 07:30 foi salvo, exibido em Hoje e reaberto no formulário de edição.

Capturas de Hoje e Gerenciar rotinas abertas e inspecionadas em desktop 1440 px e mobile 390 px. Sem regiões em branco ou sobreposição material. Em ambas as telas mobile, viewport e documento mediram 390 px, sem overflow horizontal. Axe-core 4.12.1 com regras WCAG 2 A/AA: **0 violações e 0 verificações incompletas** em ambas as telas; 25 verificações aprovadas na rodada final. Nenhum erro JavaScript reportado na sessão de QA.

Workflow `/impeccable document` aplicado ao código final: `DESIGN.md` atualizado por extração, preservando a identidade existente; `.impeccable/design.json` atualizado com schemaVersion 2 e **9 componentes**, incluindo navegação, seleção semanal, horário opcional, edição e confirmação de arquivamento. JSON salvo em UTF-8 sem BOM. As capturas ficam em `.impeccable/review/phase2/`, ignoradas pelo Git. O detector de design manteve avisos sobre Arial (justificada no CSS e DESIGN.md) e advisories de escala tipográfica; não indicou falha funcional.

## Segurança e limites

- `npm audit --omit=dev`: **0 vulnerabilidades reportadas**.
- `npm audit`: **4 alertas moderados** na cadeia de desenvolvimento Drizzle Kit/esbuild, GHSA-67mh-4wv8-2f99, já existentes. Não houve mudança de dependências ou correção automática que rebaixasse Drizzle Kit.
- Continuidade do limite local: sem autenticação, autorização por usuário ou rate limiting. Não expor publicamente. As ações de edição/arquivamento validam entrada e estado ativo; retornos são limitados a `/` ou `/rotinas`, consultas usam parâmetros e textos são escapados pelo React.
- Durante a revisão, foram integrados no repositório compartilhado os commits `a80be7c` e `bcc7716` (segurança de caminho DATABASE_URL) e `e266bc8` (sprites adicionais). Foram preservados; o commit desta fase contém apenas suas alterações de agenda, gestão, testes e documentação.
- Sem segredos versionados. Bancos, cópias, `.env`, builds e `.maestri/` permanecem fora do commit. A configuração Impeccable local criada por outro agente não faz parte desta entrega.

## Arquivos desta fase

- `src/db/schema.ts`
- `src/lib/rules.ts`, `src/lib/store.ts`
- `src/app/actions.ts`, `src/app/page.tsx`, `src/app/globals.css`
- `src/app/rotinas/page.tsx`, `src/app/routine-fields.tsx`, `src/app/archive-form.tsx`
- `tests/schedule.test.ts`
- `drizzle/0001_sudden_trauma.sql`, `drizzle/meta/0001_snapshot.json`, `drizzle/meta/_journal.json`
- `README.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `VALIDATION-PHASE2.md`
