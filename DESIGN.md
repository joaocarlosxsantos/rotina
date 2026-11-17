---
name: Rotina Pet
description: Caderno de hábitos com um companheiro vetorial.
colors:
  paper: "#f8f7f2"
  ink: "#203e32"
  muted: "#58695e"
  line: "#c5cbbf"
  green: "#315e43"
  pale: "#e8eddf"
  orange: "#ad4c30"
  green-hover: "#234930"
  button-text: "#fff"
  field-border: "#7b887b"
  field-surface: "#fffefb"
  placeholder: "#657062"
  invalid: "#a43c29"
  selection: "#d4e4b9"
  activity-divider: "#dce0d5"
  mood-border: "#8a9c7d"
  mood-sad: "#f1e3cf"
  mood-happy: "#d0e4b7"
  ground: "#bacaa3"
  progress-track: "#d9dfcf"
  error-surface: "#f7e3d9"
  error-text: "#7b2d1b"
  pet-fill: "#a9ca7b"
  pet-blush: "#d78f82"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(2.6rem, 5vw, 4.4rem)"
    fontWeight: 400
    lineHeight: 1.07
    letterSpacing: "-0.035em"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "1rem"
    lineHeight: 1.5
  control:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.5
  navigation:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.9rem"
  support:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.8rem"
    lineHeight: 1.5
  helper:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    lineHeight: 1.5
  summary:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.88rem"
    lineHeight: 1.5
  manage-display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(2.2rem, 5vw, 3.6rem)"
rounded:
  mood: "6px"
  control: "8px"
  surface: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "10px"
  md: "12px"
  row: "16px"
  control-inline: "18px"
  lg: "20px"
  surface: "24px"
  section: "30px"
  mobile-intro: "32px"
  page: "40px"
  columns: "48px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.button-text}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
  button-disabled:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.muted}"
  button-inline:
    backgroundColor: "transparent"
    textColor: "{colors.green}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-inline-hover:
    backgroundColor: "{colors.pale}"
  input:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
    width: "100%"
  pet-home:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "24px"
  new-routine:
    backgroundColor: "{colors.pale}"
    rounded: "{rounded.surface}"
    padding: "24px"
  mood:
    rounded: "{rounded.mood}"
    padding: "4px 8px"
  mood-happy:
    backgroundColor: "{colors.mood-happy}"
  mood-sad:
    backgroundColor: "{colors.mood-sad}"
  notice:
    backgroundColor: "{colors.pale}"
    rounded: "{rounded.control}"
    padding: "14px 18px"
  notice-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error-text}"
  weekday-option:
    textColor: "{colors.ink}"
    height: "48px"
    padding: "0 4px"
  edit-panel:
    textColor: "{colors.ink}"
    padding: "12px 0"
  archive-confirm:
    textColor: "{colors.orange}"
    padding: "12px 0"
---

# Design System: Rotina Pet

## Overview

**Creative North Star: "Caderno de hábitos com companheiro vetorial"**

Esta é uma descrição provisória extraída da interface implementada, não uma identidade de marca aprovada. O fundo papel, o texto verde escuro e os títulos serifados dão à tela o caráter de um caderno de uso diário. Listas separadas por linhas e formulários próximos das atividades mantêm a leitura direta.

O pet vetorial é o elemento ilustrado característico: sua expressão acompanha o estado do dia e vem acompanhada de texto. Os pets têm uma saudação breve que termina em 4,8s e respeita a preferência de movimento reduzido. Público específico, identidade de marca e linguagem visual de futuras telas continuam em aberto; esta documentação registra o código atual.

**Key Characteristics:**
- Papel claro e verde escuro, com superfícies verde suave.
- Títulos serifados e controles sem serifa, usando fontes locais.
- Rotinas em listas com divisórias e formulários no contexto.
- Companheiro vetorial original com três expressões e humor escrito.
- Estados de formulário legíveis, foco visível e movimento breve dos pets com alternativa estática.

## Colors

A paleta usa verdes sóbrios sobre papel claro; os tons quentes sinalizam foco, erro e detalhes do pet. Os valores normativos estão no frontmatter e correspondem às propriedades e valores literais do código.

### Primary

- **Verde de ação** (`green`): botões principais, contorno dos botões e progresso concluído. `green-hover` escurece a ação ao passar o ponteiro.
- **Verde de tinta** (`ink`): texto principal; os pets usam contornos próprios por espécie.
- **Verde suave** (`pale`): abrigo do pet, formulário de nova rotina, aviso de sucesso e botão desabilitado.

### Secondary

- **Terracota de foco** (`orange`): foco de teclado, cursor de texto e quadrado da assinatura.
- **Erro** (`invalid`, `error-surface`, `error-text`): borda de entrada inválida e aviso de erro.
- **Cores do companheiro:** `pet-fill` e `pet-blush` registram a base e a bochecha do Ursinho em ok/feliz. Cada espécie tem paleta própria em `src/app/pet-sprites.tsx`, com variante triste mais fria; essas paletas pertencem às ilustrações. `ground`, `mood-happy` e `mood-sad` continuam descrevendo chão e selos de humor, sem criar cores de ação.

### Neutral

- **Papel** (`paper`): fundo da página. **Campo claro** (`field-surface`) e **texto de botão** (`button-text`) apoiam os controles.
- **Texto secundário** (`muted`) e **placeholder** (`placeholder`): metadados, instruções e exemplos.
- **Divisórias** (`line`, `activity-divider`): separação entre áreas e atividades. `field-border` e `mood-border` contornam controles e humor.
- **Trilha** (`progress-track`) e **seleção** (`selection`): progresso restante e seleção de texto.

## Typography

Georgia, com Times New Roman e serif como alternativas, é a família base e dos títulos. Arial, Helvetica e sans-serif aparecem em campos, botões, rótulos, data, metadados, mensagens e rodapé. Nenhuma fonte externa é requisitada.

### Hierarchy

- **Display:** chamada principal com tamanho fluido e espaçamento de letras ligeiramente negativo; até 650px, usa (2.7rem).
- **Headline:** títulos de seção e mensagem principal do pet. O título do abrigo é menor (1.1rem), e o resumo diário usa (1.15rem).
- **Title:** nomes de rotina e título do formulário de criação.
- **Body:** base serifada; parágrafos têm largura máxima (65ch). Nomes de atividade usam (1.14rem). Texto explicativo do pet usa Arial (0.88rem).
- **Label:** rótulos sem serifa e semibold; indicação de obrigatoriedade usa peso regular e (0.75rem).
- **Pontuação:** numeral serifado (3.5rem), reduzido para (2rem) no celular; pontos e contagens usam algarismos tabulares.

## Layout

Cabeçalho, conteúdo e rodapé compartilham largura máxima (1180px), com recuo horizontal (40px). O cabeçalho tem altura (100px), assinatura à esquerda e texto curto à direita. A introdução mantém chamada e total de pontos lado a lado.

A área de trabalho usa uma coluna flexível para rotinas e uma lateral (340px), separadas por (48px). Até (850px), a lateral passa para (280px), o intervalo para (24px) e os recuos para (24px). Até (650px), a área vira uma pilha com o pet depois das rotinas, intervalo (12px) e recuos (20px); o cabeçalho passa para (78px). As linhas de formulário também passam a verticais, com botão alinhado ao início.

A gestão usa conteúdo em uma coluna com largura máxima (940px). Nome e horário da atividade ficam em duas colunas com intervalo (16px); até (650px), empilham. Os dias da semana são checkboxes nativos em linha flexível, com rótulos de pelo menos (48px) de altura. Edição e confirmação de arquivamento usam `details` e `summary` no contexto, sem modal.

Os formulários destacados e o abrigo usam preenchimento (24px). Atividades têm preenchimento vertical (16px). Nomes longos quebram dentro das colunas. Os espaçamentos são os observados, sem pressupor que todos sejam múltiplos de uma única grade.

## Elevation & Depth

Os mascotes usam gradientes leves e sombra difusa; as superfícies da interface não usam elevação animada. A profundidade vem da diferença tonal entre papel e verde suave e das divisórias finas. O chão do pet é uma elipse com gradiente radial transparente.

## Shapes

Superfícies destacadas usam cantos suaves (`surface`), controles e avisos usam cantos menores (`control`), e o selo de humor usa `mood`. Rotinas permanecem abertas sobre o papel, delimitadas por linhas de (1px). O ponto da assinatura é um quadrado (9px). O pet usa curvas suaves com contorno fino, gradiente leve e sombra elíptica difusa.

## Components

### Buttons

Ações legíveis com preenchimento sólido, altura mínima (48px), borda (1px) e peso semibold. Adicionar atividade usa fundo transparente e texto verde, com preenchimento suave no hover. O foco de teclado tem contorno terracota (3px) e afastamento (4px).

Durante submissão, o texto muda para “Salvando…” e o botão fica desabilitado. Uma atividade concluída mostra “Concluída”, preserva o estado desabilitado até o próximo dia e usa as cores suaves. Não há transição entre estados.

### Inputs / Fields

Campos claros com borda visível, altura mínima (48px) e rótulos externos permanentes. O cursor segue a cor de foco; o placeholder serve como exemplo, sem substituir o rótulo. Os nomes aceitam de 2 a 80 caracteres, com `required`, limites nativos e validação no servidor. A borda inválida usa `:user-invalid`; o foco usa o mesmo contorno dos botões.

### Cards / Containers

O formulário de nova rotina e o abrigo compartilham superfície suave, raio e preenchimento. O formulário alinha conteúdo à esquerda; o abrigo centraliza ilustração e mensagem, com título e humor na faixa superior. As rotinas existentes são listas abertas, sem cartões individuais.

### Navigation

O cabeçalho contém a assinatura e navegação “Hoje” e “Gerenciar rotinas”; o destino atual recebe `aria-current="page"`, negrito e sublinhado mais espesso. A assinatura serifada combina primeiro trecho em negrito, segundo regular e quadrado terracota. O link de pular conteúdo aparece ao receber foco e leva ao conteúdo da tela. Links recebem foco visível.

### Routine list

Cada rotina começa com linha superior, nome e contagem concluída. Cada atividade mostra nome, pontos e ação em uma linha flexível. A conclusão acrescenta texto riscado e cor secundária ao nome, além do botão desabilitado e da mensagem de pontos ganhos. O formulário de adicionar fica ao final.

A tela Hoje contém somente rotinas ativas da agenda do dia e atividades ativas; horário opcional aparece antes dos pontos. “Editar e arquivar” leva à rotina em Gerenciar rotinas. Na gestão, dias aparecem como texto abreviado, e formulários de edição ficam recolhidos em disclosures nativos. Arquivar exige abrir a explicação e pressionar “Confirmar arquivamento”; o summary e o botão usam terracota, sem apagar o histórico. Itens arquivados são consultáveis em listas sem ações de edição.

### Weekly schedule and optional time

Os dias são um `fieldset` com `legend`, sete checkboxes nativos, texto de ajuda e foco visível. Todos vêm selecionados em novas rotinas; o servidor exige ao menos um. Horário usa `input type="time"` com passo de (60s), rótulo opcional e ajuda que explica o fuso e a possibilidade de concluir antes. Os formulários de edição reutilizam os mesmos campos da criação e mantêm rótulos e limites de nome.

### Vector companion and mood

O catálogo tem 12 pets e 36 variantes: Ursinho (original), gato, cachorro, coelho, dragão, planta, hamster, raposa, panda, pinguim, pintinho e coruja. Os seis IDs originais permanecem estáveis. Marca e logomark conservam seus assets pixelados; o redesenho se restringe aos mascotes.

Os SVGs usam curvas, gradientes leves e sombra suave, sem grades ou retângulos de pixels. Cabeças grandes, olhos com dois brilhos, bochechas rosadas e traços por espécie definem o estilo fofo. Triste tem sobrancelhas inclinadas, boca caída, lágrima e postura baixa; feliz tem sorriso aberto, sobrancelhas erguidas, coração e postura alta; ok sorri discretamente.

O viewBox é 200 × 200, o tamanho padrão é 180px e a renderização é suave. Cada instância gera IDs de gradiente exclusivos com useId. Todos os sprites têm role=img, aria-label e title, inclusive quando label não é informado. O humor continua escrito: Feliz, De boa ou Triste.

O bloco `PET_MOTION_START`/`PET_MOTION_END` de `src/app/globals.css` anima o grupo do corpo: feliz sobe 3px em 2,4s por dois ciclos; ok sobe 2px em 2,4s por dois ciclos; triste desce 2px e escala a 0,98 em 4,8s por um ciclo. A piscada dura 4,8s por um ciclo; todos usam `ease-in-out`. A saudação do app termina em 4,8s. Com `prefers-reduced-motion: reduce`, animação e transformação são desativadas.

`docs/pets-preview.html` reúne 144 amostras a 64/128px sobre fundos claro/escuro. A página é estática, sem CDN, e compartilha o bloco CSS; repetição depende de ativação explícita e pode ser pausada.

### Daily progress

Barra nativa `progress`, altura (8px), trilha suave e preenchimento verde. Porcentagem e contagem são exibidas em texto, com explicação da virada do dia em São Paulo. A barra não anima; o movimento breve do companheiro segue a regra de pets acima.

### Skip, streak and points history

Concluir e “Pular (-5)” ficam no mesmo formulário da atividade, com ações distintas no servidor. Durante submissão, ambos ficam desabilitados; a ação Pular usa o tratamento terracota já adotado em arquivamento. Atividades puladas exibem “Pulada”, penalidade escrita e estado bloqueado para o dia. Em telas estreitas, as ações empilham para manter alvos legíveis.

A sequência atual é uma seção textual junto ao progresso diário, com número de dias e explicação do bônus e do saldo mínimo. O histórico ocupa a largura do conteúdo, em lista com divisórias: data civil de São Paulo, nome, conclusão/pulo, pontos base, bônus e saldo após o evento. As últimas 30 linhas são ordenadas da mais recente à mais antiga; textos e números comunicam os estados sem depender da cor. A revisão de navegador da Fase 3 pertence à Lupa pelo portal Maestri.

### Notices and empty state

Sucesso usa superfície suave e `role="status"`; erro usa tons próprios e `role="alert"`. O estado vazio permanece sobre o papel e orienta a criar uma rotina. As mensagens usam texto e semântica além de cor.

## Do's and Don'ts

### Do:
- **Do** manter as rotinas em listas abertas com divisórias e formulários junto do contexto.
- **Do** preservar fontes locais, rótulos visíveis e foco de teclado em links, campos e botões.
- **Do** acompanhar humor, progresso e conclusão com texto, além da cor e da ilustração.
- **Do** empilhar pet e formulários conforme os breakpoints implementados.

### Don't:
- **Don't** apresentar esta direção provisória como identidade de marca aprovada.
- **Don't** prolongar a saudação dos pets além de 4,8s no app ou ignorar movimento reduzido; não acrescentar sombras ou gradientes ao reproduzir esta direção.
- **Don't** aplicar pixelated/crispEdges aos mascotes vetoriais ou transformar o selo de humor em controle.
- **Don't** substituir rótulos de campos por placeholders ou depender somente de cor para estados.
