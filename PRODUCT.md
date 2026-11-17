# Rotina Pet
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js, TypeScript, Postgres e Drizzle. Neon em produção, PGlite em memória ou diretório local no desenvolvimento e nos testes, sem Docker.

## Product Purpose
Cadastrar rotinas e atividades desejadas, ganhar pontos por conclusoes e acompanhar um pet pixel feliz, ok ou triste.

## Capabilities and Constraints
Fase 7 portou o banco para Postgres. A Fase 5 acrescenta cadastro/login/logout por e-mail e senha com Neon Auth em produção e adaptador PGlite local sem rede em dev/teste. Rotinas, atividades, pontos e sequência pertencem ao usuário da sessão. Testes, build e typecheck devem passar. Sem segredos versionados. Push, recursos e execução remota pertencem ao maestro/dono.
Conclusões diárias no fuso America/Sao_Paulo, 10 pontos por atividade, sem duplicar pontos no mesmo dia. Google/social fica para a fase do Calendar.
Humor do pet: triste com menos de 40% das atividades do dia concluídas, ok de 40% a menos de 70% e feliz a partir de 70%; sem atividades previstas, fica ok.
Publico especifico e identidade de marca permanecem em aberto.
Rotinas e atividades podem ser editadas e arquivadas, preservando IDs, histórico e pontos. Rotinas têm um ou mais dias da semana (0 domingo a 6 sábado); atividades herdam esses dias e podem ter horário opcional HH:MM como referência. A página Hoje filtra os itens ativos pelo dia de São Paulo. Gerenciar rotinas permite cuidar também das agendas de outros dias e consultar arquivados.
Não há restauração de arquivados nem desfazer uma conclusão ou um pulo na interface atual.

## Gamificação — Fase 3

- Concluir uma atividade ativa da agenda do dia rende +10 pontos base. Pular é uma ação explícita que registra -5 pontos nominais, uma vez por atividade/dia de São Paulo. Não há penalidade automática para itens deixados em aberto.
- Concluir e pular compartilham o índice único de atividade/dia: a primeira ação vence; repetir a mesma ação é idempotente; a ação oposta é rejeitada. Não é possível concluir ou pular itens arquivados, filhos de rotina arquivada ou fora da agenda. UUID v4, dia e valores de pontos/bônus são validados ou determinados no servidor; os SQLs são parametrizados.
- O saldo é atualizado atomicamente em cada ação como `max(0, saldo anterior + pontos base + bônus)`. O desconto é limitado ao saldo disponível: ao pular com zero, o saldo continua zero, sem dívida para ganhos futuros. O histórico mostra -5 nominais e o saldo resultante para tornar esse limite visível.
- Sequência é o número de dias civis consecutivos em `America/Sao_Paulo` com pelo menos uma conclusão. São dias corridos, inclusive fins de semana e dias sem agenda: um dia inteiro sem conclusão quebra a sequência. Várias conclusões no mesmo dia contam como apenas um dia.
- Ao concluir, o bônus dessa conclusão é `min(sequência incluindo hoje - 1, 5)`. Exemplo: primeiro dia +0, segundo +1, terceiro +2, sexto e seguintes +5. Cada conclusão válida do dia recebe seu próprio bônus, uma única vez. O bônus não depende de quantidade de atividades concluídas no mesmo dia.
- Pular não remove conclusões nem zera diretamente a sequência; também não conta como conclusão. Se houver outra conclusão no dia, a sequência continua. Se o dia terminar apenas com pulos, ele quebra a sequência do próximo dia.
- A sequência atual é ancorada em hoje quando já houve conclusão hoje; caso contrário, mostra a sequência encerrada ontem enquanto hoje ainda pode ser cumprido. Se ontem também não teve conclusão, é zero.
- Pontos, bônus e saldo ficam registrados de forma permanente, com ordem única de lançamento. Arquivar ou editar rotinas/atividades preserva esse histórico e os dias concluídos. A tela mostra os 30 lançamentos mais recentes, incluindo arquivados, separados em +10 base, +bônus e -5 por pulo.
- O humor continua baseado somente na proporção de conclusões entre as atividades ativas previstas para hoje: triste abaixo de 40%, ok de 40% a menos de 70%, feliz a partir de 70%; sem atividades previstas fica ok. Atividades puladas permanecem no denominador e não contam como concluídas.
- A Fase 7 inicia um schema Postgres novo, com uma única migration inicial. Não há dados de produção a preservar. Os dados locais do motor anterior não são importados e podem ser descartados pelo dono; a implementação não apaga os arquivos de dados locais antigos.

## Deploy — Fase 7

- Banco de produção Neon Postgres e aplicação Vercel, com Deployment Protection configurada para All Deployments e acesso só do dono até a fase de login. A proteção da plataforma é indispensável, inclusive no domínio de produção.
- Push autorizado em `main` deve iniciar deploy de produção pela integração Git. O agente não faz push, não cria recursos e não executa migrations remotas nesta tarefa.
- Dev/teste usam PGlite em memória ou diretório restrito ao projeto. Runtime em produção/Vercel exige `DATABASE_URL` ou `POSTGRES_URL` Neon. Migrations preferem `DATABASE_URL_UNPOOLED`. Configuração ausente em produção falha, sem fallback local efêmero.
- `vercel-build` migra antes de `next build` apenas quando `VERCEL_ENV=production`. Preview nunca migra; o override `ALLOW_REMOTE_MIGRATE=1` só permite migration manual fora de Preview, sem liberar runtime remoto em dev/teste.
- Migração remota local exige flag explícita mesmo com NODE_ENV=production. Remoto não recebe backup VACUUM; o dono/maestro cuida de restauração por ponto no tempo/branches Neon e serializa deploys com migrations. Preparar/ler o journal fica fora do lote e queda de rede no COMMIT pode deixar resultado desconhecido. Reverter código não desfaz migration já confirmada.
- Saldo e bônus são calculados em transação Postgres READ COMMITTED, com advisory lock transacional por usuário e locks de leitura em rotina/atividade. Todas as operações de produto filtram `user_id` obtido da sessão, nunca do formulário; IDs de terceiros retornam erro genérico. A migration da Fase 5 preserva linhas antigas com `user_id` NULL, órfãs e inacessíveis, sem atribuí-las automaticamente a uma conta.

## Acesso — Fase 5

- `/entrar` e `/criar-conta` usam o visual do app, campos rotulados, autofill, erros em pt-BR e estados de submissão. Autenticados nessas páginas seguem para `/`; sem sessão, páginas de dados seguem para `/entrar`. Cada ação valida novamente a sessão.
- Sair no cabeçalho revoga a sessão. Cookies de produção são gerenciados pelo SDK oficial Neon Auth; o adaptador local é bloqueado em produção/Vercel. As contas locais não são contas do Neon.
- Login não muda regras de pontos, agenda, arquivamento ou humor. Ordem do ledger, saldo, histórico, sequência e bônus são separados por usuário. Deploys anteriores não devem continuar escrevendo após aplicar a migration de isolamento.
- Manter Deployment Protection até o QA remoto autorizado e a decisão do dono. Rate limiting, enumeração de e-mail e configuração de verificação/entrega de e-mail requerem validação no ambiente provisionado.
