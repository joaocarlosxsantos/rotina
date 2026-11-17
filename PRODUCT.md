# Rotina Pet
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js, TypeScript, SQLite e Drizzle, solicitados pelo usuario.

## Product Purpose
Cadastrar rotinas e atividades desejadas, ganhar pontos por conclusoes e acompanhar um pet pixel feliz, ok ou triste.

## Capabilities and Constraints
Fase 2 local, sem push e sem migration aplicada em producao. Testes, build e typecheck devem passar. Sem segredos versionados.
Decisao de implementacao: uso individual sem login; conclusoes diarias no fuso America/Sao_Paulo, 10 pontos por atividade, sem duplicar pontos no mesmo dia.
Publico especifico e identidade de marca permanecem em aberto.
Rotinas e atividades podem ser editadas e arquivadas, preservando IDs, histórico e pontos. Rotinas têm um ou mais dias da semana (0 domingo a 6 sábado); atividades herdam esses dias e podem ter horário opcional HH:MM como referência. A página Hoje filtra os itens ativos pelo dia de São Paulo. Gerenciar rotinas permite cuidar também das agendas de outros dias e consultar arquivados.
Sem penalidade por pular e sem bônus de sequência nesta fase. Não há restauração de arquivados na interface atual.
