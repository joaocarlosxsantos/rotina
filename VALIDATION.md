# Validação da fase 1 — 17/11/2026

Ambiente: Windows, Node.js 26.13.0, npm 12.1.0.

## Critério de término

- `npm run dev`: servidor pronto em 610 ms, escutando em http://127.0.0.1:3000; página carregada no navegador.
- `npm run build`: aprovado com Next.js 16.4.6, compilação e TypeScript sem erros.
- `npm run typecheck`: aprovado. `npm start -- --port 3001`: pronto em 468 ms, HTTP 200 com rotina e pet renderizados.
- `npm test`: 2 testes aprovados, 0 falhas. Integração com arquivo SQLite temporário, migrations reais, persistência após reabrir conexão, crédito único sob chamadas concorrentes, renovação diária, humor, IDs inexistentes e entrada inválida. Teste de regras inclui a meia-noite de São Paulo.
- `npm run db:migrate`: aplicado somente a `data/rotina.db` local. Nenhuma migration aplicada em produção. `db:generate` repetido sem alterações de schema.
- Bloqueio verificado: `NODE_ENV=production npm run db:migrate` encerra com erro antes de acessar o banco.

## Navegador e interface

Com agent-browser em sessão isolada: cadastro de “Minha manhã”, cadastro de “Caminhar por 15 minutos” e conclusão. Resultado observado: 10 pontos, botão Concluída desabilitado, progresso 100%, pet feliz. Esses dados de demonstração ficaram apenas no SQLite local ignorado pelo Git.

Capturas inspecionadas em desktop 1440 px e celular 390 px. No celular, largura do documento e viewport iguais a 390 px, sem overflow horizontal. `axe-core 4.12.1`, regras WCAG 2 A/AA: 0 violações, 0 verificações incompletas, 25 verificações aprovadas. Nenhum erro JavaScript reportado pelo navegador.

Revisão visual independente: `ship`, sem defeitos materiais para esta fase. Estados vazio/ok e triste foram observados no fluxo, mas as capturas finais mostram somente o estado feliz. Revisão não cobre todos os navegadores, navegação por teclado completa ou auditoria de segurança independente. Detector de design: um aviso sobre Arial; preservado por ser fonte local documentada dos controles.

## Vulnerabilidades e limites encontrados

- `npm audit --omit=dev`: zero vulnerabilidades reportadas nas dependências de produção na data da validação.
- `npm audit`: quatro alertas moderados na cadeia de desenvolvimento `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild@0.18.20`. Correspondem ao advisory GHSA-67mh-4wv8-2f99 (requisições de outra origem ao servidor de desenvolvimento do esbuild). O app usa o servidor Next.js; não inicia o servidor esbuild. Os alertas permanecem e devem ser acompanhados. A remediação automática sugerida altera a versão principal do Drizzle Kit e não foi aplicada. Não exponha ferramentas de desenvolvimento à rede.
- Ausência de autenticação, autorização por usuário e rate limiting: quem acessa o processo local pode ler e alterar os mesmos dados. Os scripts restringem a escuta a 127.0.0.1. Esta fase não está pronta para exposição pública.
- Server Actions validam nomes/IDs no servidor, limitam o corpo a 32 KB e usam a verificação de origem nativa do Next.js. Pontos e data são calculados no servidor; índice único impede duplicação. Consultas Drizzle são parametrizadas e React escapa textos. Isso não equivale a uma auditoria completa de segurança.
- Não há segredos necessários. `.env*`, SQLite, `.maestri/`, dependências e resultados de build estão ignorados; `.env.example` contém apenas o caminho padrão local.
