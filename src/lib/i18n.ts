import type { PetKind } from "./pets";

export type Locale = "pt" | "en";

export const DEFAULT_LOCALE: Locale = "pt";
export const LOCALE_COOKIE = "rotina_lang";

export function parseLocale(value: unknown): Locale {
  return value === "en" ? "en" : "pt";
}

export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "pt-BR";
}

export const WEEKDAYS_BY_LOCALE = {
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const,
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const,
};

type PetCopy = { name: string; description: string };

const PET_COPY: Record<Locale, Record<PetKind, PetCopy>> = {
  pt: {
    original: {
      name: "Ursinho",
      description: "Orelhinhas redondas, abraço de musgo e um coração tranquilo.",
    },
    gato: {
      name: "Gatinho",
      description: "Um pequeno caramelo de bigodes, curioso no seu próprio ritmo.",
    },
    cachorro: {
      name: "Cachorrinho",
      description: "Orelhas de veludo e uma pintinha de café para celebrar suas vitórias.",
    },
    coelho: {
      name: "Coelhinho",
      description: "Um algodão rosado de orelhas compridas e passos delicados.",
    },
    dragao: {
      name: "Dragãozinho",
      description: "Asinhas de lavanda, chifres dourados e coragem nas pequenas conquistas.",
    },
    planta: {
      name: "Brotinho",
      description: "Uma roseta de folhas num vasinho de barro, crescendo sem pressa com você.",
    },
    hamster: {
      name: "Hamster",
      description: "Bochechas de pãozinho e patinhas cheias de carinho.",
    },
    raposa: {
      name: "Raposinha",
      description: "Uma cauda fofinha para aquecer suas pequenas conquistas.",
    },
    panda: {
      name: "Pandinha",
      description: "Abraços macios e uma pausa gostosa entre as tarefas.",
    },
    pinguim: {
      name: "Pinguinzinho",
      description: "Passinhos juntinhos para acompanhar o seu dia.",
    },
    pintinho: {
      name: "Pintinho",
      description: "Um pinguinho de sol torcendo por você.",
    },
    coruja: {
      name: "Corujinha",
      description: "Olhinhos atentos e companhia nas horas tranquilas.",
    },
  },
  en: {
    original: {
      name: "Bear Cub",
      description: "Round little ears, a mossy hug, and a calm heart.",
    },
    gato: {
      name: "Little Cat",
      description: "A curious caramel kitty with whiskers moving at your pace.",
    },
    cachorro: {
      name: "Puppy",
      description: "Velvet ears and a coffee spot ready to cheer on every win.",
    },
    coelho: {
      name: "Bunny",
      description: "Rosy cotton with long ears and gentle, unhurried steps.",
    },
    dragao: {
      name: "Little Dragon",
      description: "Lavender wings, golden horns, and quiet courage for small wins.",
    },
    planta: {
      name: "Sproutling",
      description: "A leafy rosette in a clay pot, growing steadily beside you.",
    },
    hamster: {
      name: "Hamster",
      description: "Toasty little cheeks and paws full of warmth.",
    },
    raposa: {
      name: "Little Fox",
      description: "A fluffy tail to keep your daily milestones cozy.",
    },
    panda: {
      name: "Little Panda",
      description: "Soft hugs and a peaceful pause between tasks.",
    },
    pinguim: {
      name: "Little Penguin",
      description: "Steady little steps waddling alongside your day.",
    },
    pintinho: {
      name: "Chick",
      description: "A tiny drop of sunshine rooting for you.",
    },
    coruja: {
      name: "Owlet",
      description: "Watchful eyes and calm company during quiet hours.",
    },
  },
};

export function getPetCopy(kind: PetKind, locale: Locale = "pt"): PetCopy {
  return PET_COPY[locale][kind];
}

export const DICT = {
  pt: {
    meta: {
      titleDefault: "Rotina Pet — Caderno de hábitos com um companheiro",
      description:
        "Cuide da sua rotina diária, ganhe pontos e mantenha seu companheiro feliz.",
      signInTitle: "Entrar — Rotina Pet",
      signUpTitle: "Criar conta — Rotina Pet",
      welcomeTitle: "Rotina Pet — Seus hábitos diários com um companheiro",
      routinesTitle: "Gerenciar rotinas — Rotina Pet",
      petsTitle: "Companheiros — Rotina Pet",
      calendarTitle: "Calendário — Rotina Pet",
    },
    common: {
      brandName: "Rotina Pet",
      brandSymbol: "Rotina Pet Símbolo",
      tagline: "Um passo de cada vez.",
      saving: "Salvando…",
      languageLabel: "Idioma do site",
      ptName: "Português",
      enName: "English",
    },
    nav: {
      primaryAria: "Principal",
      quickAria: "Navegação rápida",
      today: "Hoje",
      routines: "Rotinas",
      pets: "Pets",
      calendar: "Calendário",
      signOut: "Sair",
    },
    welcome: {
      skipLink: "Pular para apresentação",
      signIn: "Entrar",
      createAccount: "Criar conta",
      heroTitle: "Seus hábitos diários, com um companheiro que sente cada passo.",
      heroSubtitle:
        "Um caderno de rotinas sereno para organizar seus dias sem pressão. Conclua atividades no seu ritmo, acumule pontos com bônus de sequência, veja sua agenda do Google Calendar e cuide de um pet que reage ao seu progresso.",
      heroCtaPrimary: "Criar minha conta grátis",
      heroCtaSecondary: "Já tenho conta — Entrar",
      heroNote: "Sem anúncios. Sem punições agressivas. Tudo salvo na sua conta.",
      demo: {
        title: "Experimente agora · Prévia interativa",
        choosePetLabel: "Troque de companheiro para testar",
        pointsLabel: "pontos hoje",
        progressLabel: "do dia concluído",
        hint: "Clique nas tarefas abaixo para ver o humor do pet mudar em tempo real.",
        moodLabels: {
          feliz: "Feliz",
          ok: "De boa",
          triste: "Triste",
        },
        moodMessages: {
          feliz: "Você fez meu dia!",
          ok: "Vamos no seu ritmo.",
          triste: "Um pequeno passo já ajuda.",
        },
        tasks: [
          { id: "water", name: "Beber um copo de água ao acordar", time: "07:30" },
          { id: "walk", name: "Caminhar ou alongar por 15 minutos", time: "12:30" },
          { id: "read", name: "Ler 10 páginas antes de dormir", time: "21:30" },
        ],
      },
      companions: {
        title: "12 companheiros originais que acompanham o seu humor.",
        subtitle:
          "Escolha o parceiro que mais combina com você na aba Pets — e troque quando quiser. A expressão dele muda conforme o percentual de atividades concluídas hoje:",
        rules: [
          {
            mood: "triste" as const,
            badge: "Triste",
            threshold: "Abaixo de 40%",
            text: "Um lembrete gentil de que um pequeno passo já ajuda.",
          },
          {
            mood: "ok" as const,
            badge: "De boa",
            threshold: "40% a 69% (ou dia livre)",
            text: "Ritmo equilibrado para dias tranquilos ou em andamento.",
          },
          {
            mood: "feliz" as const,
            badge: "Feliz",
            threshold: "A partir de 70%",
            text: "Comemoração sincera pelas conquistas do seu dia.",
          },
        ],
      },
      features: {
        title: "Tudo o que você encontra ao criar sua conta",
        subtitle:
          "Feito para funcionar todos os dias sem distrações: planeje rotinas reais, acompanhe pontos transparentes e mantenha seus compromissos por perto.",
        items: [
          {
            tag: "Agenda flexível",
            heading: "Rotinas do seu jeito, sem rigidez",
            body: "Agrupe hábitos por momento do dia e defina em quais dias da semana eles acontecem. Cada atividade pode seguir a rotina, ter seus próprios dias (como dias úteis ou fim de semana) ou acontecer em uma data única. Horários opcionais ficam como referência sem travar você.",
            highlights: [
              "Filtro automático em Hoje para mostrar apenas o que está previsto para o dia",
              "Edite nomes, dias e horários quando sua semana mudar",
              "Arquive rotinas ou atividades antigas preservando todo o histórico",
            ],
          },
          {
            tag: "Gamificação gentil",
            heading: "Pontos claros, sequência justa e zero dívida",
            body: "Cada atividade concluída rende +10 pontos base e até +5 de bônus por sequência diária. Dias em que você não agendou nada nunca quebram sua sequência. Precisou pular uma tarefa? O desconto explícito de -5 pontos nunca deixa seu saldo negativo.",
            highlights: [
              "Bônus progressivo: +0 no 1º dia até +5 a partir do 6º dia seguido",
              "Histórico permanente com os últimos 30 lançamentos detalhados",
              "Sem punição automática para tarefas deixadas em aberto",
            ],
          },
          {
            tag: "Google Calendar",
            heading: "Seus compromissos ao lado dos seus hábitos",
            body: "Conecte até 5 contas Google em modo estritamente somente leitura para visualizar seus eventos dos próximos 7 dias direto no Rotina Pet — trabalho, estudos e vida pessoal em uma linha do tempo única.",
            highlights: [
              "Suporte a múltiplos calendários e eventos de vários dias",
              "Tokens protegidos com criptografia AES-256-GCM",
              "Desconecte qualquer conta com um clique a qualquer momento",
            ],
          },
          {
            tag: "Feito com cuidado",
            heading: "Privado, acessível e bilíngue",
            body: "Cada conta mantém suas rotinas, pontos, sequência e pet isolados. A interface acompanha o tema claro ou escuro do seu sistema, respeita preferência de movimento reduzido, prioriza navegação por teclado e funciona em Português e Inglês.",
            highlights: [
              "Contraste verificado WCAG AA/AAA nos modos claro e escuro",
              "Layout responsivo para celular (barra inferior) e desktop",
              "Troque entre Português e Inglês quando quiser no topo da página",
            ],
          },
        ],
      },
      cta: {
        title: "Pronto para dar o primeiro passo hoje?",
        subtitle:
          "Crie sua conta em segundos e monte sua primeira rotina com o companheiro que você escolher.",
        primary: "Criar minha conta",
        secondary: "Entrar na minha conta",
      },
    },
    auth: {
      skipLink: "Pular para o formulário",
      backToWelcome: "← Conhecer o Rotina Pet",
      signUpTitle: "Seu primeiro passo.",
      signInTitle: "Bom ter você aqui.",
      signUpSubtitle: "Crie sua conta para cuidar da sua rotina e do seu companheiro.",
      signInSubtitle: "Entre para continuar sua rotina, no seu ritmo.",
      checkEmailNotice:
        "Confira seu e-mail e entre para continuar. Se necessário, confirme o cadastro pelo link recebido.",
      nameLabel: "Seu nome",
      namePlaceholder: "Como podemos te chamar?",
      emailLabel: "E-mail",
      emailPlaceholder: "seu@email.com",
      passwordLabel: "Senha",
      passwordPlaceholderSignUp: "No mínimo 8 caracteres",
      passwordPlaceholderSignIn: "Sua senha",
      passwordHint: "De 8 a 128 caracteres.",
      showPassword: "Mostrar senha",
      hidePassword: "Ocultar senha",
      showPasswordAria: "Mostrar senha digitada",
      hidePasswordAria: "Ocultar senha digitada",
      creatingAccount: "Criando conta…",
      signingIn: "Entrando…",
      createAccountBtn: "Criar conta",
      signInBtn: "Entrar",
      alreadyHaveAccount: "Já tem uma conta?",
      noAccountYet: "Ainda não tem uma conta?",
      goToSignIn: "Entrar",
      goToSignUp: "Criar conta",
    },
    today: {
      skipLink: "Pular para minhas rotinas",
      headlineLine1: "Pequenos passos.",
      headlineLine2: "Dias melhores.",
      subtitle: "Faça algo por você. Seu companheiro cresce junto.",
      pointsBalance: "saldo de pontos",
      routinesTitle: "Minhas rotinas de hoje",
      routineSingular: "rotina",
      routinePlural: "rotinas",
      emptyTitle: "Seu dia está em aberto.",
      emptyPrefix: "Nenhuma rotina ativa prevista para hoje. Crie uma rotina abaixo ou",
      emptyLink: "ajuste os dias em Gerenciar rotinas",
      editAndArchive: "Editar e arquivar",
      emptyRoutineHint: "O que você quer fazer nesta rotina?",
      pointsUnit: "pontos",
      bonusLabel: "bônus",
      skippedToday: "pulada hoje",
      doneBtn: "Concluída",
      skippedBtn: "Pulada",
      completeBtn: "Concluir",
      skipBtn: (penalty: number) => `Pular (-${penalty})`,
      activityActionsAria: (name: string) => `Concluir ou pular ${name}`,
      addActivityTitle: "Adicionar atividade",
      addBtn: "Adicionar",
      newRoutineTitle: "Cultive uma nova rotina",
      createRoutineBtn: "Criar rotina",
      companionTitle: "Seu companheiro",
      moods: {
        feliz: "Feliz",
        ok: "De boa",
        triste: "Triste",
      },
      moodCopy: {
        feliz: "Você fez meu dia!",
        ok: "Vamos no seu ritmo.",
        triste: "Um pequeno passo já ajuda.",
      },
      petEmptyHint: "Adicione sua primeira atividade para começarmos juntos.",
      petActiveHint: "Cada atividade concluída é um cuidado com você e com seu pet.",
      dailyTitle: "Seu dia até aqui",
      dailyProgressAria: "Atividades concluídas hoje",
      dailyCount: (done: number, total: number) =>
        `${done} de ${total} atividades concluídas`,
      dailyResetNote: "O dia vira à meia-noite de São Paulo. Seus pontos ficam com você.",
      streakTitle: "Sequência atual",
      daySingular: "dia",
      dayPlural: "dias",
      streakExplain: (base: number, maxBonus: number) =>
        `Conclua ao menos uma atividade por dia. Cada conclusão rende +${base} pontos e até +${maxBonus} de bônus por sequência.`,
      streakSkipExplain: (penalty: number) =>
        `Pular desconta até ${penalty} pontos. O saldo nunca fica negativo; pular não conta como conclusão.`,
      gentleLine1: "Constância vale mais que perfeição.",
      gentleLine2: "Amanhã tem uma nova chance.",
      historyTitle: "Histórico de pontos",
      historyHint: (penalty: number) =>
        `Últimos 30 registros, do mais recente ao mais antigo. O desconto de -${penalty} é limitado ao saldo disponível, sem gerar dívida.`,
      historyEmpty: "Suas conclusões e atividades puladas aparecerão aqui.",
      statusCompleted: "Concluída",
      statusSkipped: "Pulada",
      streakBonusEntry: "bônus de sequência",
      balanceLabel: "Saldo",
    },
    manage: {
      skipLink: "Pular para gerenciar rotinas",
      title: "Sua rotina, do seu jeito.",
      subtitle:
        "Organize os dias, ajuste atividades e guarde o que já fez parte da sua jornada.",
      activeTitle: "Todas as rotinas ativas",
      emptyActive: "Você ainda não tem rotinas ativas. Crie uma abaixo.",
      editRoutineSummary: (name: string) => `Editar rotina: ${name}`,
      editRoutineAria: (name: string) => `Editar rotina ${name}`,
      saveRoutine: "Salvar rotina",
      pastDateTag: " · Data encerrada",
      noTimeSet: "Sem horário definido",
      editActivitySummary: (name: string) => `Editar atividade: ${name}`,
      editActivityAria: (name: string) => `Editar atividade ${name}`,
      saveActivity: "Salvar atividade",
      addActivitySummary: (name: string) => `Adicionar atividade em ${name}`,
      addActivityAria: (name: string) => `Adicionar atividade em ${name}`,
      addActivityBtn: "Adicionar atividade",
      archivedActivitiesSummary: "Atividades arquivadas desta rotina",
      archivedSuffix: "— arquivada",
      createRoutineTitle: "Criar uma rotina",
      createRoutineBtn: "Criar rotina",
      archivedTitle: "Rotinas arquivadas",
      archivedHint:
        "Permanecem guardadas com suas atividades. Não entram na agenda de hoje.",
      noArchived: "Nenhuma rotina arquivada.",
      archive: {
        routineNoun: "rotina",
        activityNoun: "atividade",
        summary: (noun: string, name: string) => `Arquivar ${noun}: ${name}`,
        warning: (isRoutine: boolean) =>
          `Arquivar oculta ${
            isRoutine ? "a rotina e suas atividades" : "a atividade"
          } do dia. Histórico e pontos permanecem guardados.`,
        ariaLabel: (name: string) => `Confirmar arquivamento de ${name}`,
        confirmBtn: "Confirmar arquivamento",
      },
    },
    fields: {
      routineNameLabel: "Nome da rotina",
      requiredTag: "(obrigatório)",
      routineNamePlaceholder: "Ex.: Minha manhã",
      weekdaysLegend: "Dias da semana",
      weekdaysHint: "Escolha ao menos um dia. A agenda segue o fuso de São Paulo.",
      activityNameLabel: "Nome da atividade",
      activityNamePlaceholder: "Ex.: caminhar por 15 minutos",
      timeLabel: "Horário",
      optionalTag: "(opcional)",
      timeHint: "Referência em São Paulo; não bloqueia a conclusão.",
      recurrenceLegend: "Repetição",
      repeatModes: {
        inherit: "Segue a rotina",
        weekdays: "Dias da semana",
        once: "Só uma vez",
      },
      inheritHint: (summary: string) => `Dias da rotina: ${summary}.`,
      spDayHint: "A agenda segue o dia de São Paulo.",
      presetsAria: "Atalhos de dias",
      presets: {
        all: "Todos",
        weekdays: "Dias úteis",
        weekend: "Fim de semana",
      },
      activityDaysAria: "Dias da atividade",
      chooseOneDayError: "Escolha pelo menos um dia da semana.",
      onceDateLabel: "Data (obrigatória)",
    },
    pets: {
      skipLink: "Pular para lista de companheiros",
      eyebrow: "Seu Companheiro",
      title: "Escolha quem caminha com você.",
      subtitle:
        "Cada pet traz uma energia única para a sua jornada. Seu progresso diário reflete no humor do seu parceiro em cada pequena vitória.",
      catalogTitle: "Companheiros disponíveis",
      petsCount: (n: number) => `${n} pets`,
      currentBadge: "Pet atual",
      currentBadgeAria: "Pet atualmente selecionado",
      moods: {
        sad: "Triste",
        ok: "De boa",
        happy: "Feliz",
      },
      activeCompanion: "✓ Companheiro ativo",
      chooseBtn: (name: string) => `Escolher ${name}`,
      petAriaLabel: (name: string, mood: "feliz" | "ok" | "triste") =>
        `${name} — ${{ feliz: "Pet feliz", ok: "Pet de boa", triste: "Pet triste" }[mood]}`,
    },
    calendar: {
      skipLink: "Pular para o calendário",
      eyebrow: "Google Calendar",
      title: "Seus compromissos e rotinas em um só lugar.",
      subtitle:
        "Conecte múltiplas contas do Google (modo somente leitura) para acompanhar seus eventos dos próximos 7 dias sem sair do seu caderno de hábitos.",
      unconfiguredTitle: "Integração em configuração",
      unconfiguredBodyPrefix:
        "A sincronização com o Google Calendar requer a configuração das chaves de integração no servidor (variáveis",
      unconfiguredBodyAnd: "e",
      unconfiguredHint: "Suas rotinas e companheiro continuam funcionando normalmente.",
      agendaTitle: "Agenda dos próximos 7 dias",
      todayIs: (date: string) => `Hoje é ${date}`,
      eventSingular: "evento",
      eventPlural: "eventos",
      limitNotice: (max: number) => `Mostrando os ${max} primeiros eventos.`,
      noAccountsTitle: "Nenhuma conta Google conectada.",
      noAccountsBody:
        "Conecte suas contas de trabalho, estudos ou pessoal para visualizar todos os seus eventos dos próximos 7 dias organizados por dia e horário.",
      connectFirstBtn: "Conectar primeira conta Google",
      noEventsTitle: "Nenhum evento agendado para os próximos 7 dias.",
      noEventsBody:
        "Seus próximos 7 dias estão livres nas contas conectadas. Ótimo momento para avançar nas suas rotinas e cuidar do seu pet!",
      allDay: "Dia inteiro",
      until: (end: string) => `até ${end}`,
      continues: "Continua",
      continuesSub: "dia inteiro",
      endsAt: (end: string) => `Até ${end ?? "fim"}`,
      endsSub: "término",
      startsSub: "início",
      todayLabel: (d: string) => `Hoje — ${d}`,
      tomorrowLabel: (d: string) => `Amanhã — ${d}`,
      calendarBadgeTitle: (name: string) => `Calendário: ${name}`,
      multiDayBadge: "Multi-dia",
      multiDayTitle: "Evento que se estende por múltiplos dias",
      accountBadgeTitle: (email: string) => `Conta: ${email}`,
      viewInGoogle: "Ver no Google Agenda ↗",
      viewInGoogleAria: (title: string) => `Ver evento "${title}" no Google Agenda`,
      connectedAccountsTitle: "Contas conectadas",
      connectAnotherBtn: "+ Conectar outra conta Google",
      noLinkedAccounts: "Você ainda não possui contas do Google vinculadas.",
      reconnect: "Reconectar",
      synced: "● Sincronizado",
      removeBtn: "Remover",
      removeAria: (email: string) => `Remover conta ${email}`,
      privacyTitle: "Privacidade e Segurança",
      privacyBodyBefore: "O Rotina Pet solicita acesso",
      privacyBodyStrong: "estritamente somente leitura",
      privacyBodyAfter:
        ". Seus dados nunca são compartilhados ou alterados e as chaves de acesso são encriptadas com padrão militar AES-256-GCM.",
      defaultCalendarName: "Principal",
      untitledEvent: "(Sem título)",
      errors: {
        access_denied: "A autorização foi cancelada ou recusada no Google.",
        missing_params:
          "Sessão de autorização expirada ou incompleta. Tente conectar novamente.",
        invalid_session: "Sessão de autorização corrompida. Tente conectar novamente.",
        invalid_state:
          "Falha na validação de segurança da autorização (state inválido).",
        user_mismatch:
          "A conta precisa ser vinculada pelo mesmo usuário autenticado.",
        unconfigured:
          "Integração com Google Calendar indisponível ou não configurada no servidor.",
        no_offline_access:
          "O Google não forneceu permissão de atualização offline. Conecte novamente autorizando o acesso.",
        email_unverified: "A conta Google precisa ter um e-mail verificado.",
        account_limit:
          "Limite máximo de 5 contas Google atingido. Remova uma conta antes de conectar outra.",
        auth_failed: "Não foi possível autorizar a conta Google. Tente novamente.",
        remove_failed: "Não foi possível remover a conta. Tente novamente.",
        invalid_account: "Identificador de conta inválido.",
      } as Record<string, string>,
      success: {
        connected: "Conta Google conectada com sucesso!",
        removed: "Conta Google removida com sucesso.",
      } as Record<string, string>,
      accountErrors: {
        expired: "Autorização expirada ou revogada. Reconecte a conta.",
        unavailable: "Não foi possível acessar esta conta no momento.",
        partial:
          "Algumas contas ou calendários demoraram para responder. Mostrando o que carregou.",
      },
    },
    rules: {
      everyDay: "Todo dia",
      weekdays: "Dias úteis",
      weekend: "Fim de semana",
      onlyOn: (dd: string, mm: string) => `Só ${dd}/${mm}`,
      completedOk: "Conclusão registrada. Cada atividade vale pontos uma vez por dia.",
      alreadyCompleted: "Já concluída hoje",
      skippedOk: (penalty: number) =>
        `Atividade pulada. Desconto de até ${penalty} pontos aplicado, respeitando o saldo mínimo de zero.`,
      alreadySkipped: "Já pulada hoje",
    },
    serverMessages: {
      routineCreated: "Rotina criada. Agora adicione suas atividades.",
      activityAdded: "Atividade adicionada à sua rotina.",
      routineUpdated: "Rotina atualizada.",
      activityUpdated: "Atividade atualizada.",
      routineArchived: "Rotina arquivada. Histórico e pontos preservados.",
      activityArchived: "Atividade arquivada. Histórico e pontos preservados.",
      petUpdated: "Companheiro atualizado com sucesso!",
      genericSaveError: "Não foi possível salvar. Tente novamente mais tarde.",
      genericAuthError: "Não foi possível acessar agora. Tente novamente mais tarde.",
      signOutError: "Não foi possível sair. Tente novamente.",
    },
  },
  en: {
    meta: {
      titleDefault: "Rotina Pet — Habit notebook with a digital companion",
      description:
        "Care for your daily routine, earn points, and keep your companion happy.",
      signInTitle: "Sign in — Rotina Pet",
      signUpTitle: "Create account — Rotina Pet",
      welcomeTitle: "Rotina Pet — Your daily habits with a companion",
      routinesTitle: "Manage routines — Rotina Pet",
      petsTitle: "Companions — Rotina Pet",
      calendarTitle: "Calendar — Rotina Pet",
    },
    common: {
      brandName: "Rotina Pet",
      brandSymbol: "Rotina Pet Symbol",
      tagline: "One step at a time.",
      saving: "Saving…",
      languageLabel: "Site language",
      ptName: "Português",
      enName: "English",
    },
    nav: {
      primaryAria: "Primary",
      quickAria: "Quick navigation",
      today: "Today",
      routines: "Routines",
      pets: "Pets",
      calendar: "Calendar",
      signOut: "Sign out",
    },
    welcome: {
      skipLink: "Skip to introduction",
      signIn: "Sign in",
      createAccount: "Create account",
      heroTitle: "Your daily habits, with a companion that feels every step.",
      heroSubtitle:
        "A calm habit notebook to organize your days without pressure. Complete activities at your own pace, earn points with streak bonuses, keep your Google Calendar events in view, and care for a pet that reacts to your progress.",
      heroCtaPrimary: "Create my free account",
      heroCtaSecondary: "I already have an account — Sign in",
      heroNote: "No ads. No harsh penalties. Everything saved to your account.",
      demo: {
        title: "Try it now · Interactive preview",
        choosePetLabel: "Switch companion to test",
        pointsLabel: "points today",
        progressLabel: "of today done",
        hint: "Click the tasks below to watch your pet's mood respond live.",
        moodLabels: {
          feliz: "Happy",
          ok: "Steady",
          triste: "Sad",
        },
        moodMessages: {
          feliz: "You made my day!",
          ok: "Taking it at your pace.",
          triste: "Even one small step helps.",
        },
        tasks: [
          { id: "water", name: "Drink a glass of water after waking up", time: "07:30" },
          { id: "walk", name: "Walk or stretch for 15 minutes", time: "12:30" },
          { id: "read", name: "Read 10 pages before bed", time: "21:30" },
        ],
      },
      companions: {
        title: "12 original companions that reflect your daily mood.",
        subtitle:
          "Pick the partner that fits you best on the Pets tab — and switch anytime. Its expression reacts to the share of today's activities you complete:",
        rules: [
          {
            mood: "triste" as const,
            badge: "Sad",
            threshold: "Below 40%",
            text: "A gentle reminder that even one small step helps.",
          },
          {
            mood: "ok" as const,
            badge: "Steady",
            threshold: "40% to 69% (or free day)",
            text: "Balanced energy for quiet days or days in progress.",
          },
          {
            mood: "feliz" as const,
            badge: "Happy",
            threshold: "70% and above",
            text: "Warm celebration for everything you accomplished today.",
          },
        ],
      },
      features: {
        title: "Everything waiting for you inside your account",
        subtitle:
          "Designed to work every day without noise: plan real-life routines, track transparent points, and keep your schedule close.",
        items: [
          {
            tag: "Flexible schedule",
            heading: "Routines built around your real week",
            body: "Group habits by time of day and choose which weekdays they run. Every activity can inherit its routine, set custom weekdays (like weekdays or weekends), or appear on a single date. Optional times stay as a reference without locking you out.",
            highlights: [
              "Automatic Today view showing only what is scheduled for the day",
              "Edit names, schedules, and times whenever your week shifts",
              "Archive old routines or tasks while keeping your full history",
            ],
          },
          {
            tag: "Gentle gamification",
            heading: "Clear points, fair streaks, and zero debt",
            body: "Each completed activity earns +10 base points plus up to +5 daily streak bonus. Days with no scheduled tasks never break your streak. Need to skip a task? An explicit -5 skip never drops your balance below zero.",
            highlights: [
              "Progressive streak bonus: +0 on day 1 up to +5 from day 6 onward",
              "Permanent ledger showing your 30 most recent entries",
              "No automatic penalty for tasks left unfinished",
            ],
          },
          {
            tag: "Google Calendar",
            heading: "Your events alongside your daily habits",
            body: "Connect up to 5 Google accounts in strict read-only mode to see your next 7 days of events right inside Rotina Pet — work, study, and personal calendars in one chronological feed.",
            highlights: [
              "Supports multiple calendars and multi-day events",
              "Tokens encrypted at rest with AES-256-GCM",
              "Disconnect any account in one click whenever you want",
            ],
          },
          {
            tag: "Crafted with care",
            heading: "Private, accessible, and bilingual",
            body: "Every account keeps its routines, points, streaks, and companion strictly isolated. The interface follows your system light or dark theme, respects reduced motion, works smoothly by keyboard, and runs in both Portuguese and English.",
            highlights: [
              "WCAG AA/AAA verified contrast in both light and dark modes",
              "Responsive layout for mobile (bottom tab bar) and desktop",
              "Switch between Portuguese and English anytime from the top bar",
            ],
          },
        ],
      },
      cta: {
        title: "Ready to take your first step today?",
        subtitle:
          "Create your account in seconds and start your first routine with the companion you choose.",
        primary: "Create my account",
        secondary: "Sign in to my account",
      },
    },
    auth: {
      skipLink: "Skip to form",
      backToWelcome: "← Explore Rotina Pet",
      signUpTitle: "Your first step.",
      signInTitle: "Good to have you here.",
      signUpSubtitle: "Create your account to care for your routine and your companion.",
      signInSubtitle: "Sign in to continue your routine, at your own pace.",
      checkEmailNotice:
        "Check your email and sign in to continue. If required, confirm your registration using the link you received.",
      nameLabel: "Your name",
      namePlaceholder: "What should we call you?",
      emailLabel: "Email",
      emailPlaceholder: "you@email.com",
      passwordLabel: "Password",
      passwordPlaceholderSignUp: "At least 8 characters",
      passwordPlaceholderSignIn: "Your password",
      passwordHint: "8 to 128 characters.",
      showPassword: "Show password",
      hidePassword: "Hide password",
      showPasswordAria: "Show typed password",
      hidePasswordAria: "Hide typed password",
      creatingAccount: "Creating account…",
      signingIn: "Signing in…",
      createAccountBtn: "Create account",
      signInBtn: "Sign in",
      alreadyHaveAccount: "Already have an account?",
      noAccountYet: "Don't have an account yet?",
      goToSignIn: "Sign in",
      goToSignUp: "Create account",
    },
    today: {
      skipLink: "Skip to my routines",
      headlineLine1: "Small steps.",
      headlineLine2: "Better days.",
      subtitle: "Do something kind for yourself. Your companion grows alongside you.",
      pointsBalance: "points balance",
      routinesTitle: "My routines for today",
      routineSingular: "routine",
      routinePlural: "routines",
      emptyTitle: "Your day is wide open.",
      emptyPrefix: "No active routines scheduled for today. Create a routine below or",
      emptyLink: "adjust days in Manage routines",
      editAndArchive: "Edit and archive",
      emptyRoutineHint: "What would you like to do in this routine?",
      pointsUnit: "points",
      bonusLabel: "bonus",
      skippedToday: "skipped today",
      doneBtn: "Done",
      skippedBtn: "Skipped",
      completeBtn: "Complete",
      skipBtn: (penalty: number) => `Skip (-${penalty})`,
      activityActionsAria: (name: string) => `Complete or skip ${name}`,
      addActivityTitle: "Add activity",
      addBtn: "Add",
      newRoutineTitle: "Grow a new routine",
      createRoutineBtn: "Create routine",
      companionTitle: "Your companion",
      moods: {
        feliz: "Happy",
        ok: "Steady",
        triste: "Sad",
      },
      moodCopy: {
        feliz: "You made my day!",
        ok: "Taking it at your pace.",
        triste: "Even one small step helps.",
      },
      petEmptyHint: "Add your first activity so we can start together.",
      petActiveHint: "Every completed activity is care for yourself and your pet.",
      dailyTitle: "Your day so far",
      dailyProgressAria: "Activities completed today",
      dailyCount: (done: number, total: number) =>
        `${done} of ${total} activities completed`,
      dailyResetNote: "The day resets at midnight São Paulo time. Your points stay with you.",
      streakTitle: "Current streak",
      daySingular: "day",
      dayPlural: "days",
      streakExplain: (base: number, maxBonus: number) =>
        `Complete at least one activity per day. Each completion earns +${base} points and up to +${maxBonus} streak bonus.`,
      streakSkipExplain: (penalty: number) =>
        `Skipping deducts up to ${penalty} points. Your balance never goes negative; skipping doesn't count as completion.`,
      gentleLine1: "Consistency matters more than perfection.",
      gentleLine2: "Tomorrow brings a fresh start.",
      historyTitle: "Points history",
      historyHint: (penalty: number) =>
        `Last 30 entries, newest first. The -${penalty} deduction is capped at your available balance, with no debt.`,
      historyEmpty: "Your completed and skipped activities will appear here.",
      statusCompleted: "Completed",
      statusSkipped: "Skipped",
      streakBonusEntry: "streak bonus",
      balanceLabel: "Balance",
    },
    manage: {
      skipLink: "Skip to manage routines",
      title: "Your routine, your way.",
      subtitle:
        "Organize days, tune activities, and archive what has already served its part in your journey.",
      activeTitle: "All active routines",
      emptyActive: "You don't have any active routines yet. Create one below.",
      editRoutineSummary: (name: string) => `Edit routine: ${name}`,
      editRoutineAria: (name: string) => `Edit routine ${name}`,
      saveRoutine: "Save routine",
      pastDateTag: " · Past date",
      noTimeSet: "No time set",
      editActivitySummary: (name: string) => `Edit activity: ${name}`,
      editActivityAria: (name: string) => `Edit activity ${name}`,
      saveActivity: "Save activity",
      addActivitySummary: (name: string) => `Add activity to ${name}`,
      addActivityAria: (name: string) => `Add activity to ${name}`,
      addActivityBtn: "Add activity",
      archivedActivitiesSummary: "Archived activities in this routine",
      archivedSuffix: "— archived",
      createRoutineTitle: "Create a routine",
      createRoutineBtn: "Create routine",
      archivedTitle: "Archived routines",
      archivedHint:
        "Kept safe with their activities. They won't appear on today's schedule.",
      noArchived: "No archived routines.",
      archive: {
        routineNoun: "routine",
        activityNoun: "activity",
        summary: (noun: string, name: string) => `Archive ${noun}: ${name}`,
        warning: (isRoutine: boolean) =>
          `Archiving hides ${
            isRoutine ? "the routine and its activities" : "the activity"
          } from your day. History and points remain saved.`,
        ariaLabel: (name: string) => `Confirm archiving ${name}`,
        confirmBtn: "Confirm archive",
      },
    },
    fields: {
      routineNameLabel: "Routine name",
      requiredTag: "(required)",
      routineNamePlaceholder: "e.g., My morning",
      weekdaysLegend: "Days of the week",
      weekdaysHint: "Choose at least one day. Schedule follows São Paulo time.",
      activityNameLabel: "Activity name",
      activityNamePlaceholder: "e.g., walk for 15 minutes",
      timeLabel: "Time",
      optionalTag: "(optional)",
      timeHint: "São Paulo reference time; does not block completion.",
      recurrenceLegend: "Repeat",
      repeatModes: {
        inherit: "Follow routine",
        weekdays: "Days of the week",
        once: "One time only",
      },
      inheritHint: (summary: string) => `Routine days: ${summary}.`,
      spDayHint: "Schedule follows the day in São Paulo.",
      presetsAria: "Day shortcuts",
      presets: {
        all: "Every day",
        weekdays: "Weekdays",
        weekend: "Weekend",
      },
      activityDaysAria: "Activity days",
      chooseOneDayError: "Choose at least one day of the week.",
      onceDateLabel: "Date (required)",
    },
    pets: {
      skipLink: "Skip to companions list",
      eyebrow: "Your Companion",
      title: "Choose who walks with you.",
      subtitle:
        "Each pet brings its own energy to your journey. Your daily progress shapes your partner's mood with every small win.",
      catalogTitle: "Available companions",
      petsCount: (n: number) => `${n} pets`,
      currentBadge: "Current pet",
      currentBadgeAria: "Currently selected pet",
      moods: {
        sad: "Sad",
        ok: "Steady",
        happy: "Happy",
      },
      activeCompanion: "✓ Active companion",
      chooseBtn: (name: string) => `Choose ${name}`,
      petAriaLabel: (name: string, mood: "feliz" | "ok" | "triste") =>
        `${name} — ${{ feliz: "Happy pet", ok: "Steady pet", triste: "Sad pet" }[mood]}`,
    },
    calendar: {
      skipLink: "Skip to calendar",
      eyebrow: "Google Calendar",
      title: "Your events and routines in one place.",
      subtitle:
        "Connect multiple Google accounts (read-only mode) to follow your next 7 days of events without leaving your habit notebook.",
      unconfiguredTitle: "Integration being configured",
      unconfiguredBodyPrefix:
        "Google Calendar sync requires server integration keys to be configured (environment variables",
      unconfiguredBodyAnd: "and",
      unconfiguredHint: "Your routines and companion continue working normally.",
      agendaTitle: "Next 7 days schedule",
      todayIs: (date: string) => `Today is ${date}`,
      eventSingular: "event",
      eventPlural: "events",
      limitNotice: (max: number) => `Showing the first ${max} events.`,
      noAccountsTitle: "No Google account connected.",
      noAccountsBody:
        "Connect your work, study, or personal accounts to view all your upcoming 7-day events organized by day and time.",
      connectFirstBtn: "Connect first Google account",
      noEventsTitle: "No events scheduled for the next 7 days.",
      noEventsBody:
        "Your next 7 days are clear across your connected accounts. A great moment to focus on your routines and care for your pet!",
      allDay: "All day",
      until: (end: string) => `to ${end}`,
      continues: "Continues",
      continuesSub: "all day",
      endsAt: (end: string) => `Until ${end ?? "end"}`,
      endsSub: "ends",
      startsSub: "starts",
      todayLabel: (d: string) => `Today — ${d}`,
      tomorrowLabel: (d: string) => `Tomorrow — ${d}`,
      calendarBadgeTitle: (name: string) => `Calendar: ${name}`,
      multiDayBadge: "Multi-day",
      multiDayTitle: "Event spanning multiple days",
      accountBadgeTitle: (email: string) => `Account: ${email}`,
      viewInGoogle: "View in Google Calendar ↗",
      viewInGoogleAria: (title: string) => `View event "${title}" in Google Calendar`,
      connectedAccountsTitle: "Connected accounts",
      connectAnotherBtn: "+ Connect another Google account",
      noLinkedAccounts: "You haven't linked any Google accounts yet.",
      reconnect: "Reconnect",
      synced: "● Synced",
      removeBtn: "Remove",
      removeAria: (email: string) => `Remove account ${email}`,
      privacyTitle: "Privacy & Security",
      privacyBodyBefore: "Rotina Pet requests",
      privacyBodyStrong: "strictly read-only",
      privacyBodyAfter:
        " access. Your data is never shared or modified, and access tokens are encrypted with AES-256-GCM.",
      defaultCalendarName: "Primary",
      untitledEvent: "(Untitled)",
      errors: {
        access_denied: "Authorization was canceled or declined in Google.",
        missing_params:
          "Authorization session expired or incomplete. Please try connecting again.",
        invalid_session: "Authorization session is corrupted. Please try connecting again.",
        invalid_state: "Authorization security validation failed (invalid state).",
        user_mismatch: "The account must be linked by the same signed-in user.",
        unconfigured:
          "Google Calendar integration is unavailable or not configured on the server.",
        no_offline_access:
          "Google did not grant offline refresh permission. Please reconnect and allow access.",
        email_unverified: "The Google account must have a verified email address.",
        account_limit:
          "Maximum limit of 5 Google accounts reached. Remove an account before connecting another.",
        auth_failed: "Could not authorize the Google account. Please try again.",
        remove_failed: "Could not remove the account. Please try again.",
        invalid_account: "Invalid account identifier.",
      } as Record<string, string>,
      success: {
        connected: "Google account connected successfully!",
        removed: "Google account removed successfully.",
      } as Record<string, string>,
      accountErrors: {
        expired: "Authorization expired or revoked. Please reconnect the account.",
        unavailable: "Could not access this account right now.",
        partial:
          "Some accounts or calendars took too long to respond. Showing what loaded.",
      },
    },
    rules: {
      everyDay: "Every day",
      weekdays: "Weekdays",
      weekend: "Weekend",
      onlyOn: (dd: string, mm: string) => `Only ${mm}/${dd}`,
      completedOk: "Completion recorded. Each activity earns points once per day.",
      alreadyCompleted: "Already completed today",
      skippedOk: (penalty: number) =>
        `Activity skipped. Up to ${penalty} points deducted, keeping your balance at zero or above.`,
      alreadySkipped: "Already skipped today",
    },
    serverMessages: {
      routineCreated: "Routine created. Now add your activities.",
      activityAdded: "Activity added to your routine.",
      routineUpdated: "Routine updated.",
      activityUpdated: "Activity updated.",
      routineArchived: "Routine archived. History and points preserved.",
      activityArchived: "Activity archived. History and points preserved.",
      petUpdated: "Companion updated successfully!",
      genericSaveError: "Could not save right now. Please try again later.",
      genericAuthError: "Could not access right now. Please try again later.",
      signOutError: "Could not sign out. Please try again.",
    },
  },
} as const;

export function getDictionary(locale: Locale = "pt") {
  return DICT[locale];
}

const PT_TO_EN_ERROR_MAP: ReadonlyArray<[string, string]> = [
  // Auth errors
  ["Não foi possível acessar. Confira os dados e tente novamente.", "Could not sign in. Check your details and try again."],
  ["Informe um e-mail válido.", "Please enter a valid email address."],
  ["A senha deve ter de 8 a 128 caracteres.", "Password must be between 8 and 128 characters."],
  ["O nome deve ter de 2 a 80 caracteres.", "Name must be between 2 and 80 characters."],
  ["Sessão necessária.", "Authentication required."],
  ["Adaptador local indisponível neste ambiente.", "Local adapter is unavailable in this environment."],
  ["Autenticação indisponível. Tente novamente mais tarde.", "Authentication is unavailable. Please try again later."],
  ["Não foi possível criar a conta. Confira os dados ou tente entrar se já possui cadastro.", "Could not create account. Check your details or try signing in if you already have one."],
  ["Não foi possível sair. Tente novamente.", "Could not sign out. Please try again."],
  // Rules / Store errors
  ["Escolha pelo menos um dia da semana, de 0 a 6.", "Choose at least one day of the week."],
  ["Dias da semana devem ser números inteiros de 0 a 6.", "Weekdays must be integers from 0 to 6."],
  ["Informe uma data válida no formato AAAA-MM-DD.", "Enter a valid date in YYYY-MM-DD format."],
  ["Repetição inválida. Escolha os dias ou uma data.", "Invalid repeat option. Choose weekdays or a date."],
  ["Escolha pelo menos um dia da semana.", "Choose at least one day of the week."],
  ["Escolha dias da semana ou só uma data, nunca os dois.", "Choose weekdays or a single date, never both."],
  ["Repetição inválida. Escolha pelo menos um dia ou informe uma data válida.", "Invalid repeat option. Choose at least one day or a valid date."],
  ["Informe um horário HH:MM entre 00:00 e 23:59, ou deixe vazio.", "Enter a time HH:MM between 00:00 and 23:59, or leave blank."],
  ["Informe um nome de 2 a 80 caracteres.", "Enter a name between 2 and 80 characters."],
  ["Use um nome de 2 a 80 caracteres, sem quebras de linha.", "Use a name of 2 to 80 characters without line breaks."],
  ["Seleção inválida. Atualize a página e tente novamente.", "Invalid selection. Refresh the page and try again."],
  ["Rotina ativa não encontrada. Atualize a página.", "Active routine not found. Refresh the page."],
  ["Atividade ativa não encontrada. Atualize a página.", "Active activity not found. Refresh the page."],
  ["Atividade indisponível hoje ou arquivada. Atualize a página.", "Activity is unavailable today or archived. Refresh the page."],
  ["Atividade já concluída hoje. Não é possível pular no mesmo dia.", "Activity already completed today. Cannot skip on the same day."],
  ["Atividade já pulada hoje. Não é possível concluir no mesmo dia.", "Activity already skipped today. Cannot complete on the same day."],
  ["Pet inválido. Escolha um companheiro do catálogo.", "Invalid pet. Choose a companion from the catalog."],
];

const PT_TO_EN_EXACT = new Map(PT_TO_EN_ERROR_MAP);

export function localizeErrorMessage(message: string, locale: Locale): string {
  if (locale === "pt") return message;
  return PT_TO_EN_EXACT.get(message) ?? message;
}
