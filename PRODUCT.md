# Rotina Pet
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js, TypeScript, SQLite e Drizzle, solicitados pelo usuario.

## Product Purpose
Cadastrar rotinas e atividades desejadas, ganhar pontos por conclusoes e acompanhar um pet pixel feliz, ok ou triste.

## Capabilities and Constraints
Desenvolvimento local e preparação de deploy Vercel/Turso na Fase 6. Testes, build e typecheck devem passar. Sem segredos versionados. Push, recursos e execução remota pertencem ao maestro/dono, não a esta implementação.
Decisao de implementacao: uso individual sem login; conclusoes diarias no fuso America/Sao_Paulo, 10 pontos por atividade, sem duplicar pontos no mesmo dia.
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
- A migration local mantém as conclusões antigas como concluídas, com bônus zero e saldo acumulado original. Elas contribuem para a sequência de futuras conclusões, mas não recebem bônus retroativo. Com migration local pendente, o script cria um snapshot SQLite consistente e mantém cinco cópias; se o backup falhar, não aplica. SQLite local em produção e caminhos fora do projeto seguem bloqueados; a política remota está na Fase 6.

## Deploy — Fase 6

- Banco de produção Turso/libsql e aplicação Vercel, com Deployment Protection configurada para All Deployments e acesso só do dono. Não existe login por usuário no app; a proteção da plataforma é indispensável, inclusive no domínio de produção.
- Push autorizado em `main` deve iniciar deploy de produção pela integração Git. O agente não faz push, não cria recursos e não executa migrations remotas nesta tarefa.
- Dev/teste usam SQLite em arquivo restrito ao projeto. Runtime remoto exige `libsql://`, token e `VERCEL` definido ou `NODE_ENV=production`. Configuração ausente na Vercel falha em vez de usar arquivo efêmero.
- `vercel-build` migra antes de `next build` apenas quando `VERCEL_ENV=production`. Preview nunca migra; o override `ALLOW_REMOTE_MIGRATE=1` só permite migration manual fora de Preview, sem liberar runtime remoto em dev/teste.
- Remoto não recebe backup VACUUM; o dono/maestro cuida de PITR/branch no Turso e serializa deploys com migrations. O SDK transaciona o lote remoto, mas preparar/ler o journal fica fora dele e queda de rede no COMMIT pode deixar resultado desconhecido. Reverter código não desfaz migration já confirmada.
