# Validação — Fase 7: Neon Postgres e PGlite

Base: `32ada28`. Validação local em 17/11/2026. Sem push, login, recursos Vercel ou conexão/migration em banco remoto.

## Resultado

| Verificação | Resultado |
| --- | --- |
| `npm test` | 44 testes passaram; zero falhas ou ignorados |
| `npm run build` | Passou, sem avisos de tracing |
| `npm run typecheck` | Passou |
| `npm run db:generate` | Uma migration inicial Postgres gerada |
| `npm run db:migrate` | Aplicada somente em PGlite local, em `data/pglite` |
| `npm run dev -- --port 3002` | Servidor local iniciou; GET `/` e `/rotinas` retornaram HTTP 200; encerrado após verificação |
| `npm run vercel-build` em Preview | Passou com URL deliberadamente inválida e override ativo; migration ignorada antes de abrir banco |
| `npm audit --omit=dev` | Zero vulnerabilidades |
| `npm audit` | Quatro moderadas na cadeia de desenvolvimento: esbuild, @esbuild-kit/core-utils, @esbuild-kit/esm-loader e drizzle-kit |
| `git diff --check` | Sem erros de whitespace |

Os quatro achados de desenvolvimento são relacionados ao servidor de desenvolvimento do esbuild e sua cadeia transitiva do drizzle-kit. Não houve atualização fora das dependências autorizadas. Não expor ferramentas de desenvolvimento publicamente.

## Alterações e cobertura

- `src/db/schema.ts`, `drizzle.config.ts` e `drizzle/`: schema pg-core com UUID, timestamptz, date e enum; uma migration inicial substitui as três SQLite. Índices únicos de atividade/dia e ordem; checks de saldo, bônus, agenda e pontos. Dados locais antigos não foram apagados nem importados.
- `src/db/client.ts`, `migration-policy.ts`, `migrations.ts` e `scripts/migrate.ts`: PGlite restrito ao projeto ou memória em dev/teste; Neon obrigatório em produção/Vercel, sem fallback; aliases e URL unpooled para migrations; Preview nunca migra; execução remota local exige flag. Falhas de configuração/migration omitem credenciais. Não há VACUUM.
- `src/lib/store.ts`, ações e páginas: acesso assíncrono Postgres, transação READ COMMITTED com advisory lock para saldo/bônus e locks de linha para agenda/arquivamento. Mantidas regras +10, -5, piso zero, sequência, bônus máximo 5, humor e dia SP.
- Testes existentes portados para PGlite; novos helpers e testes de migrations/política. Cobrem Promise.all para duplicatas, concluir contra pular, saldo/bônus concorrentes, UUID não-v4, agenda/arquivamento, persistência, constraints, rollback de DDL/journal e virada 02:59Z/03:00Z.
- `package.json`, lockfile e `next.config.ts`: somente as adições autorizadas, @neondatabase/serverless 1.2.1 e @electric-sql/pglite 0.5.16. Cliente anterior removido; `npm ls @libsql/client` vazio. Metadados opcionais de peers do Drizzle podem continuar mencionando outros drivers no lockfile.
- `.env.example`, `README.md`, `PRODUCT.md` e este relatório: ambiente sem valores, deploy Neon pela Vercel, proteção, recuperação e limites. Relatórios antigos incompatíveis com o novo motor foram removidos: VALIDATION.md e VALIDATION-PHASE2/3/6.md.

## Riscos e limites

- Nenhuma integração Neon remota foi executada. Os testes usam Postgres embarcado em PGlite. Promise.all valida concorrência nesse motor, que serializa transações numa instância; disputa entre conexões/processos Neon depende do advisory lock Postgres e ainda precisa de QA remoto autorizado. O driver escolhido usa Pool WebSocket com transações interativas; não usa o transporte HTTP sem transações interativas. Requer Node.js 22+.
- O migrator Drizzle Postgres prepara schema/tabela de controle fora do lote e aplica migrations e avanço do journal dentro de transação. Rollback foi comprovado em PGlite; não foi executado em Neon. Deploys concorrentes devem ser serializados. Queda de rede durante COMMIT pode deixar resultado desconhecido: verificar journal antes de repetir. Falha do build ou reversão de código não desfaz migration confirmada.
- Recuperação Neon depende da janela de restauração por ponto no tempo e branches contratada/configurada pelo dono. Não há backup local aplicável ao remoto.
- PGlite persistente deve ser aberto por um único processo; parar o servidor antes de migrar o mesmo diretório. O diretório padrão novo é ignorado pelo Git.
- Login e isolamento por usuário continuam pendentes. Ledger/lock são globais; a fase de login deve particionar dados, locks e autorização por usuário. Até lá, manter Deployment Protection em todos os deploys, somente para o dono.
- Preview precisa de banco/branch isolado com schema previamente preparado para funcionar no runtime. O build pode passar sem URL válida porque páginas de dados são dinâmicas; runtime de produção falha sem configuração.
- `.impeccable/config.json` já estava não rastreado na base e fica fora do commit. Não foram usados navegador ou agent-browser.

Referências: [Drizzle + Neon](https://orm.drizzle.team/docs/connect-neon), [transações](https://orm.drizzle.team/docs/transactions), [locks Postgres](https://www.postgresql.org/docs/current/explicit-locking.html), [PGlite](https://pglite.dev/docs/api), [Vercel + Neon](https://neon.com/docs/guides/vercel-managed-integration) e [branches Neon](https://neon.com/docs/introduction/branching).
