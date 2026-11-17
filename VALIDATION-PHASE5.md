# Validação — Fase 5: login e isolamento

## Estado

Implementação concluída sobre `573fa03`. Checkpoint local `8431355` criado a pedido do maestro; depois disso, documentação e relatório finalizados. O commit de marca `476571d` foi feito por outro agente no diretório compartilhado e não integra os arquivos deste trabalho.

Pronto:

- SDK oficial `@neon/auth@0.8.2`, conforme documentação atual de Next.js, instalado como única dependência direta nova. Produção/Vercel usa Neon; dev/teste usa adaptador PGlite sem rede.
- Interface `getCurrentUser`, cadastro/login/logout locais com senha scrypt, token aleatório com hash persistido, expiração e revogação. Adaptador local bloqueado em produção/Vercel.
- `/entrar`, `/criar-conta`, botão Sair, proteção de páginas e ações, redirecionamentos fixos. Visual existente, rótulos, autofill e alternância de senha. Revisão estática sem bloqueadores; QA visual pertence à Lupa.
- Todas as operações do store recebem usuário do servidor e filtram proprietário. Ledger, saldo, sequência e lock são por usuário. IDs de terceiros retornam os mesmos erros de IDs inexistentes.
- Migration `0001_ordinary_firelord.sql` adiciona `user_id` nullable e índice de ordem por usuário, sem apagar dados. Aplicada apenas no PGlite local. Dados antigos ficam órfãos inacessíveis.
- HTTP local comprovou cadastro A/B, proteção, criação privada, logout e novo login. Nenhum banco/serviço Neon remoto acessado.

Validação final:

- `npm test`: 59/59 passaram (55 testes de produto/autenticação/migrations e quatro de marca adicionados pelo outro agente). Nenhum ignorado ou falhando. Rodada focada: 16/16.
- `npm run build` e `npm run typecheck`: passaram. Build sem avisos de tracing; aviso de metadataBase nas imagens sociais do trabalho de marca, fora do escopo do login.
- Migration testada também a partir do schema da Fase 7 com dados existentes: IDs, histórico e saldo preservados, `user_id` NULL e inacessível; sem atribuição automática.
- Testes de A/B cobrem leitura, criação de filho, edição, arquivamento, conclusão e pulo; sessão ausente em todas as funções; saldo/sequência/bônus/ordem separados; Promise.all; lock parametrizado por usuário. Testes antigos mantêm virada SP 02:59Z/03:00Z, agenda e humor.
- Adaptador local testado com cadastro, login, senha incorreta/conta inexistente, expiração, rotação e replay após logout. Sessões e senhas não são persistidas em claro. Produção/Vercel bloqueia adaptador local, inclusive VERCEL vazio.
- Smoke HTTP local sem navegador: cadastro A/B, `/` e `/rotinas` sem sessão redirecionam, conta autenticada em `/entrar` vai a `/`, rotina de A invisível a B, Sair e novo login funcionaram. Servidor da verificação encerrado.
- Preview nunca migra mesmo com override: testes existentes continuam passando. Nenhuma migration remota foi executada.
- README, PRODUCT e `.env.example` atualizados. Segredos não foram gravados. Somente o SDK autorizado foi adicionado diretamente: `@neon/auth@0.8.2`.

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

## Segurança e riscos

- Produção precisa de `NEON_AUTH_BASE_URL` e **`NEON_AUTH_COOKIE_SECRET` aleatório com 32+ caracteres**, configurado pelo dono/maestro. `VITE_NEON_AUTH_URL` provisionado não substitui o segredo nem é utilizado pelo servidor Next. Não foi consultado nenhum valor remoto.
- SDK configura cookies Secure, HttpOnly e SameSite=Lax; sem logs do SDK (`silent`). Não são retornados erros brutos do provedor. Autorização consulta sessão sem cache de cookie; logout usa revogação do SDK. Não houve teste de integração remoto: cookies reais, revogação entre instâncias e domínio confiável devem ser confirmados pela Lupa/maestro.
- Server Actions validam a sessão e campos; a origem é comparada pelo Next.js, com corpo máximo de 32KB. Endpoint SDK POST também exige origem igual ao app. A API expõe apenas métodos de e-mail/senha, sessão e saída; login social permanece desabilitado no app.
- Não há rate limit distribuído próprio. Validar limites e proteção contra credential stuffing/cadastro abusivo no Neon Auth/Vercel antes de abrir acesso. Desenvolvimento local é apenas loopback, sem senha real.
- Login desconhecido e senha errada têm a mesma mensagem. Cadastro e comportamento/tempo/respostas do provedor ainda podem permitir enumeração de e-mail; mensagem genérica não garante resistência completa. Verificação de e-mail/entrega são configurações do provedor; se usar código OTP, falta implementar essa UI antes de ativar tal fluxo. Recuperação de senha também não está incluída. Nenhum recurso/configuração remota foi criado ou alterado.
- `npm audit` e `npm audit --omit=dev`: **4 moderadas**, zero altas/críticas. Cadeia esbuild <=0.24.2 → @esbuild-kit/core-utils → @esbuild-kit/esm-loader → drizzle-kit ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)). Agora também aparece em produção porque Better Auth traz peer opcional de drizzle-kit. O achado trata de acesso ao servidor de desenvolvimento esbuild; nenhum servidor desse tipo foi adicionado ao runtime do app. Não foi aplicada correção com troca de dependências fora da autorização. Rever a cadeia antes de liberar publicamente.
- Autorização é da aplicação; não há RLS. Futuras queries precisam conservar o filtro de proprietário. `user_id` continua nullable para preservar órfãos; somente o dono poderá planejar uma atribuição explícita futura. Enquanto versões antigas puderem escrever, haverá registros órfãos: encerrar/restringir deploys antigos após a migration. Fazer rollout coordenado, pois rollback de código não reverte migration.
- Lock por hash de usuário: colisão apenas serializa usuários desnecessariamente; não mistura dados. Concorrência é testada no PGlite (uma instância), não em múltiplas conexões Neon.

## Interface e arquivos

Revisão estática independente e comparação com DESIGN.md/sidecar: sistema preservado. Detector só apontou avisos de escala tipográfica (incluindo tamanhos preexistentes); título da tela de acesso usa teto 3rem. Cabeçalho autenticado no celular agora admite segunda linha e mínimo 100px para acomodar Sair; autenticação mantém o cabeçalho de 78px. Sem novas cores/fontes/efeitos. Aparência em 390×844, teclado, autofill real e leitor de tela precisam de QA da Lupa; não houve navegador ou agent-browser.

Arquivos do checkpoint: `src/auth/{contracts,neon,local,server}.ts`, `src/proxy.ts`, `src/app/api/auth/[...path]/route.ts`, `src/app/{auth-actions.ts,auth-form.tsx,auth-page.tsx,entrar/page.tsx,criar-conta/page.tsx,actions.ts,page.tsx,rotinas/page.tsx,globals.css}`, `src/db/schema.ts`, `src/lib/store.ts`, `drizzle/0001_ordinary_firelord.sql`, `drizzle/meta/{0001_snapshot,_journal}.json`, `package.json`, `package-lock.json`, `tests/{auth,isolation,gamification,migrations,routine,schedule}.test.ts`, `tests/helpers.ts` e este relatório. Fechamento: `.env.example`, `README.md`, `PRODUCT.md` e este relatório.

Modern Web Guidance: apliquei `autofill-sign-in-form` ("Use `autocomplete=\"current-password\"` for an existing password") e `autofill-sign-up-form` ("For a sign-up form, use `autocomplete=\"new-password\"`"). Campos usam nomes/IDs estáveis, username para e-mail, required e permitem colar senha. Mantida a interface nativa sem exigir JS para submissão; login social e recuperação não foram acrescentados por estarem fora do escopo.

Referências oficiais lidas antes da implementação: [Next.js Neon Auth](https://neon.com/docs/auth/quick-start/nextjs-api-only), [SDK servidor](https://neon.com/docs/auth/reference/nextjs-server), [verificação de e-mail](https://neon.com/docs/auth/guides/email-verification) e guias da versão instalada do Next.js em `node_modules/next/dist/docs/01-app/02-guides/{authentication,server-actions}.md`.
