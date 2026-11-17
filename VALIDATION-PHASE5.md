# Validação — Fase 5: login e isolamento

## Estado

Checkpoint solicitado durante a implementação, base `573fa03`.

Pronto:

- SDK oficial `@neon/auth@0.8.2`, conforme documentação atual de Next.js, instalado como única dependência direta nova. Produção/Vercel usa Neon; dev/teste usa adaptador PGlite sem rede.
- Interface `getCurrentUser`, cadastro/login/logout locais com senha scrypt, token aleatório com hash persistido, expiração e revogação. Adaptador local bloqueado em produção/Vercel.
- `/entrar`, `/criar-conta`, botão Sair, proteção de páginas e ações, redirecionamentos fixos. Visual existente, rótulos, autofill e alternância de senha. Revisão estática sem bloqueadores; QA visual pertence à Lupa.
- Todas as operações do store recebem usuário do servidor e filtram proprietário. Ledger, saldo, sequência e lock são por usuário. IDs de terceiros retornam os mesmos erros de IDs inexistentes.
- Migration `0001_ordinary_firelord.sql` adiciona `user_id` nullable e índice de ordem por usuário, sem apagar dados. Aplicada apenas no PGlite local. Dados antigos ficam órfãos inacessíveis.
- HTTP local comprovou cadastro A/B, proteção, criação privada, logout e novo login. Nenhum banco/serviço Neon remoto acessado.

Falta concluir:

- Fechar testes novos de migration não destrutiva e a rodada final de testes/build/typecheck. A primeira rodada passou 53/54: um texto do adaptador local foi corrompido por encoding durante edição; foi corrigido antes deste checkpoint.
- Atualizar README, PRODUCT e `.env.example`; documentar configuração adicional `NEON_AUTH_COOKIE_SECRET`, riscos de rate limit/enumeração e limites da validação remota.
- Revisar política da API de autenticação e registrar relatório final. Não implementar Google ou login social.
- Confirmar somente arquivos próprios no commit final e retornar ao Claude Maestro.

Como verificar, com Node.js 22+:

```powershell
npm test
npm run build
npm run typecheck
# Rodada focada:
node --import tsx --test --test-concurrency=1 tests/auth.test.ts tests/isolation.test.ts tests/migrations.test.ts
# Desenvolvimento local, sem ambiente de produção:
npm run db:migrate
npm run dev
```

Dev usa `data/pglite` por padrão. Não abrir o mesmo diretório PGlite em processos simultâneos; parar o servidor antes de migrar. Preview continua sem migrations. Não há push ou execução remota autorizados. Arquivos de marca e `.impeccable/config.json` de outros trabalhos ficam fora deste commit.
