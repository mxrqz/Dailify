import type { Repeat } from "@dailify/shared";
import { parseDuration } from "./durations";
import { parseRepeat } from "./repeat";
import { type Span, spanOf } from "./spans";
import { parseWhen } from "./when";
import { HOUR_WORD_RE, normalize, startOfDay } from "./vocab";

/**
 * Por que o parser pode ter errado — cada motivo é um gatilho determinístico, não um score. Vazio =
 * confiante. O composer usa isso pra oferecer a IA ("Melhorar com a Mew"), nunca pra chamá-la sozinho:
 * alarme falso custa um botão, motivo que falta custa uma tarefa errada em silêncio.
 */
export type UnsureCode =
  | "question"
  | "command"
  | "multi"
  | "list-values"
  | "repeat-unsupported"
  | "alert"
  | "vague"
  | "ambiguous-number"
  | "ambiguous-word"
  | "leftover"
  | "dangling"
  | "past"
  | "long";

export interface Unsure {
  code: UnsureCode;
  /** Trecho do input que disparou o motivo, quando há um só. */
  span?: Span;
}

export interface UnsureInput {
  input: string;
  normalized: string;
  /** O normalizado com tudo que o parser consumiu (e o que ele guardou de propósito) apagado —
   * o que sobrou no título, alinhado com o input. `null` quando a série não cabe no `Repeat`. */
  rest: string | null;
  /** O normalizado sem links e nomes próprios: o que os detectores de tempo enxergaram. */
  visible: string;
  title: string;
  /** Algum detector de tempo (dia, hora, duração, série) leu alguma coisa. */
  consumed: boolean;
  date: Date | null;
  hasTime: boolean;
  repeat: Repeat;
  now: Date;
}

const EN_MARKER_RE =
  /\b(?:the|my|on|due|by|at|for|with|and|to|of|in|is|tomorrow|today|next|pay|call|buy|return)\b/;

// "o que tenho amanhã", "is the gym open sunday": a pergunta se anuncia na primeira palavra —
// pronome interrogativo, auxiliar inglês com sujeito, "tenho algo" — a não ser que outra oração
// venha depois ("quanto custa o conserto — perguntar amanhã"). "o que levar", "what to buy", "do
// the dishes" e "tenho que ligar" são tarefa.
const QUESTION_LEAD_RE =
  /^\s*(?:o\s+que\s+(?:eu\s+|a\s+gente\s+)?(?![a-z]+(?:ar|er|ir)\b)[a-z]|que\s+(?:horas?|dia)\b|qua(?:l|is)\b|quant[ao]s?\b|quando\s+(?:e|eh|vence|tenho|tem|sera|foi|que|vai|vou|comeca|termina|acaba)\b|onde\s+(?:e|fica|tem|vai|vou|era)\b|quem\b|cade\b|(?:por\s*que|pq)\b|como\s+(?:ta|esta|fica|ficou|e|anda|vai|foi|estao)\b|sera\s+que\b|(?:eu\s+)?(?:tenho|tem|ha)\s+(?:algo|algum|alguma|nada|coisa|compromisso)\b|(?:eu\s+)?(?:estou|to|tou|fico)\s+(?:livre|ocupad)|(?:voce|vc)\s+(?:pode|sabe|consegue|lembra|tem)\b|what(?:\s*s\b|\s+(?!to\b|if\b)[a-z])|whats\b|when\s*(?:s|is|do|does|did|am|are|was|will|can|should)\b|where\s*(?:s|is|are|do|did|was|should|can)\b|wheres\b|which\b|who\s*(?:s|is|are|do|did|was|will|has)\b|why\b|how\s*(?:s|is|are|much|many|long|do|does|did|was|about)\b|hows\b|any(?:thing|one|body)?\b|(?:am|is|are|was|were|isn\s*t|aren\s*t)\s+[a-z]|(?:do|does|did|have|has|can|could|will|would|should|shall|may)\s+(?:i|we|you|u|they|he|she|there)\b)/;
// "ligar pro João — ele vem?": a interrogação de uma oração depois de travessão/vírgula é do título.
const QUESTION_TAIL_RE = /\?[\s!?.\p{Extended_Pictographic}]*$/u;
const CLAUSE_BREAK_RE = /[—–:;,(]|\s-\s/;

// Comando sobre o que já está na agenda: verbo de gestão no começo + referência à agenda do usuário
// (artigo/possessivo + evento ou tarefa, um horário dela — "my 3pm", "a das 10" —, "tudo", a agenda,
// ou o destino de tempo que o parser leu: "pra quinta"). Sem referência o objeto é de terceiros
// ("cancelar a assinatura da Netflix", "delete old photos") e é tarefa. Verbo que só existe pra
// agenda (remarcar, adiar, reschedule) e "me mostra"/"show me" dispensam a referência.
const SCHEDULE_VERB_RE =
  /^\s*(?:(?:por\s+favor|please|pls)\s+)?(?:(?:cancela|cancele|apaga|apague|exclui|exclua|deleta|adia|adie|remarca|remarque|desmarca|desmarque|reagenda|reagende|adiar|remarcar|desmarcar|reagendar|antecipa|antecipe|atrasa|atrase|renomeia|renomeie|reschedule|postpone|snooze|undo|rename)\b|clear\s+(?:my|everything|all)\b|(?:complete|conclui|concluir)\s+(?:buy|call|email|pay|send|book|fix|check|[a-z]+(?:ar|er|ir))\b|push\s+(?:back|everything|all|my)\b|(?:me\s+)?(?:mostra|mostre|lista|liste)\s+(?:pra\s+mim\s+)?(?:o\s+que|tudo|minhas?|meus?|as\s+tarefas|a\s+agenda)\b|me\s+(?:mostra|mostre|lista|liste|fala|diz|diga)\b|(?:show|tell|give)\s+me\b|(?:show|list)\s+(?:my|all|everything|what)\b|(?:marca|marcar|marque)\s+(?:\S+\s+){0,5}como\s+(?:feit|conclu|lid)|mark\s+(?:\S+\s+){0,5}(?:as\s+)?(?:done|complete|read)\b|passa\s+(?:a|o|as|os)\s+.*\b(?:pra|pras|para)\b|(?:joga|jogue|empurra|empurre|passa|deixa)\s+(?:\S+\s+){0,4}pra\s+(?:depois|frente)\b)/;
const EDIT_VERB_RE =
  /^\s*(?:(?:por\s+favor|please|pls)\s+)?(?:muda|mude|mudar|cancelar|apagar|excluir|deletar|mova|move|mover|empurra|empurrar|transfere|transferir|joga|jogar|troca|trocar|conclui|concluir|tira|tirar|remove|remover|edita|editar|passa|passar|cancel|delete|change|complete|remove|edit|push|bump|shift|drop|set)\b/;
// "cancel gym tomorrow", "delete tomorrow's gym session": apagar algo com dia é a sessão da agenda.
const REMOVE_VERB_RE =
  /^\s*(?:(?:por\s+favor|please|pls)\s+)?(?:cancel|delete)\b(?!.*\b(?:membership|subscription|account|plan|order|card|policy|reservation|booking)s?\b)/;
const EVENT_NOUN = String.raw`(?:tarefas?|lembretes?|compromissos?|eventos?|reuni(?:ao|oes)|calls?|consultas?|aulas?|alarmes?|entregas?|horarios?|datas?|recorrencias?|prioridades?|priority|recurrence|daily|standup|sync|1\s*[:x]\s*1|tasks?|reminders?|events?|meetings?|appointments?|appts?|alarms?)`;
const SCHEDULE_REF_RE = new RegExp(
  [
    String.raw`(?:\b(?:o|a|os|as|meu|minha|meus|minhas|esse|essa|este|esta|todas?|todos?|my|the|this|that|all|these)\s+(?:\S+\s+){0,2}?|^\s*\S+\s+)${EVENT_NOUN}\b`,
    String.raw`\b(?:tarefas?|tasks?|lembretes?|reminders?|prioridade|priority)\b`,
    String.raw`\b(?:my|the|o|os)\s+(?:d[ao]s?\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|h)\b|\b(?:my|the)\s+\d{1,2}:\d{2}\b|\b(?:o|a|os|as)\s+d[ao]s?\s+\d{1,2}\b`,
    String.raw`\b(?:tudo|everything)\b`,
    String.raw`\b(?:d[aeo]\s+(?:minha\s+)?(?:agenda|calendario|lista)|from\s+(?:my|the)\s+(?:calendar|list|schedule))\b`,
  ].join("|"),
);
// "move standup to 9:30", "change the dentist to 4pm": mover com o destino sendo o tempo que o
// parser leu. "move the couch to the garage saturday" leva o sofá, não a tarefa.
const MOVE_RE =
  /^\s*(?:(?:por\s+favor|please)\s+)?(?:move|mova|mover|muda|mudar|change|push|passa|transfere|bump|joga|troca|empurra|adianta)\b/;
const TARGET_RE = /\b(?:pra|pras|para|pro|to|until|ate)\s+$/;

// "comprar pão e ligar pro João", "pagar boleto + renovar matrícula": dois verbos de tarefa, cada um
// com o seu complemento ("ler doc e comentar" é uma tarefa só). Sem palavra funcional do pt, a frase
// que abre com verbo inglês é inglesa e o "-er" não é infinitivo: "buy salt and pepper" é uma compra.
const EN_VERB =
  "buy|call|email|text|send|pay|book|clean|wash|pick|take|get|go|write|read|review|finish|fix|check|schedule|meet|visit|cook|walk|feed|water|print|sign|submit|order|return|drop|bring|prepare|renew|update|file|ask|tell|reply|plan|make|study|watch|run|grab|mail|ship|charge|clear";
const VERB = String.raw`(?:[a-z]+(?:ar|er|ir)|${EN_VERB})`;
const PT_WORD_RE = /\b(?:o|os|as|de|do|da|dos|das|pra|pro|com|no|na|um|uma|que|para|em|e)\b/;
const twoVerbs = (verb: string) =>
  new RegExp(
    String.raw`^\s*${verb}\s+[^;]+?(?:,|\s(?:e|and|depois|then|[+&]))\s+(?:(?:tambem|also|depois|then)\s+)?${verb}\s+[a-z\d]`,
  );
const TWO_VERBS_RE = twoVerbs(VERB);
const TWO_EN_VERBS_RE = twoVerbs(`(?:${EN_VERB})`);
// "fazer o de história, depois o de geografia", "gym then groceries": a sequência anuncia outra tarefa.
const CHAIN_RE =
  /(?:,|\s(?:e|and))\s*(?:depois|then|em\s+seguida|after\s+that|afterwards)\s+(?!(?:d[aeo]s?|que|of|from|disso)\b)[a-z]|[a-z]\s+then\s+[a-z]|\sdepois\s+(?!d[aeo]s?\b)[a-z]*(?:ar|er|ir)\b/;
// "1) enviar nf 2) cobrar", "• pão • leite", "- pão - leite": lista numerada ou com marcador.
const LIST_RE =
  /(?:^|\s)\d{1,2}[.)]\s+\S.*\s\d{1,2}[.)]\s+\S|[•·▪]\s*\S.*[•·▪]\s*\S|^\s*[-*]\s+\S.*\s[-*]\s+\S/;
// "lugar"/"jantar"/"bar" e afins terminam em -ar sem ser verbo de tarefa.
const NOT_VERB_RE =
  /^(?:niver|their|later|chair|hair|pair|fair|air|year|dear|near|lugar|bar|mar|par|colar|altar|polar|solar|lar|mulher|prazer|lazer|hangar|celular|familiar|militar|particular|popular|regular|similar|escolar|titular|auxiliar|exemplar|super|her|over|per|after|under|order|letter|paper|poster|dinner|summer|winter|never|other|either|whether|computer|chapter|server)$/;

// "8h e 20h", "dia 10 e dia 25", "the 10th and 25th": dois valores onde o modelo guarda um.
const VALUE = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:h\b|hs\b|am\b|pm\b)|\d{1,2}(?:st|nd|rd|th)\b|dias?\s+\d{1,2}\b|the\s+\d{1,2}(?:st|nd|rd|th)\b)`;
const LIST_VALUES_RE = new RegExp(
  String.raw`${VALUE}\s*(?:,|&|\be\b|\band\b)\s*(?:(?:as|at|o|the|dia)\s+)?(?:\d{1,2}(?::\d{2})?\s*(?:h\b|hs\b|am\b|pm\b)|\d{1,2}(?:st|nd|rd|th)\b|\d{1,2}\b)`,
);

// Série que o `Repeat` não guarda (o índice já deixa no título as que o detector forte pega).
const REPEAT_HINT_RE = new RegExp(
  [
    String.raw`\b(?:bi|tri)mestra(?:l|is|lmente)\b|\bsemestra(?:l|is|lmente)\b|\bquinzena(?:l|is|lmente|s)?\b|\bquarterly\b|\bhourly\b|\bbiweekly\b|\bfortnightly\b`,
    String.raw`\bde\s+hora\s+em\s+hora\b|\b(?:(?:semana|dia|mes)\s+)?sim,?\s+(?:semana|dia|mes)\s+nao\b|\bevery\s+other\b`,
    String.raw`\b(?:a\s+)?cada\s+(?:\d+|${HOUR_WORD_RE})\b|\bevery\s+(?:\d+|${HOUR_WORD_RE})\s+\w+`,
    String.raw`\b(?:tod[ao]s?|cada|every)\s+(?:\S+\s+){0,3}(?:bimestres?|trimestres?|semestres?|quarters?)\b`,
    String.raw`\b(?:\d+\s*[ºª]?|primeiro|segundo|terceiro|quarto|quinto|sexto|decimo)\s+dia\s+util\b|\b(?:ultimo|last)\s+(?:dia|day)\b`,
  ].join("|"),
);

// "quinta entregar relatório trimestral": com o dia marcado, o adjetivo do documento diz de que
// período ele é, não que a tarefa repete.
const DOC_NOUN = String.raw`(?:relatorio|balanco|fechamento|imposto|prova|exame|revisao|avaliacao|planejamento|metas?|resultados?|boletim|report|review|taxes|tax|earnings|results|goals|planning|okrs?|newsletter)s?`;
const DOC_PERIOD_RE = new RegExp(
  String.raw`\b${DOC_NOUN}\s+(?:bi|tri|se)mestra(?:l|is)\b|\b(?:quarterly|biweekly)\s+${DOC_NOUN}\b`,
);

// "me avisa 15 min antes", "remind me a day before": antecedência é o alerta, que o parser não lê.
const ALERT_RE =
  /\b(?:\d{1,3}|um|uma|a|an|one|meia)\s*(?:min(?:uto)?s?|minutes?|h|hrs?|horas?|hours?|dias?|days?|semanas?|weeks?)\s+(?:antes|before|de\s+antecedencia|in\s+advance|ahead|early|earlier|prior)\b(?!\s+de\s+[a-z]+(?:ar|er|ir)\b)|\b(?:alerta|aviso|notificacao|alert|notification)\s+(?:de\s+|of\s+)?(?:\d|um|uma|meia|a\s|an\s)|\bantecedencia\b|\b(?:me\s+acord[ae]|wake\s+me|despertador|set\s+(?:an?\s+)?alarm)\b|\balarmes?\s+(?:d[ae]\s+|para\s+|pra\s+|as\s+)?(?:\d|daqui)|\b(?:alarme|alarm)\s*$|(?:toca|toque|tocar)\s+(?:um\s+)?alarme|\b(?:the\s+(?:night|day|morning|evening)\s+before|na\s+vespera|n[ao]\s+(?:noite|dia)\s+anterior)\b/;

// Tempo que não é data. Três famílias de palavra fechada: conector subordinativo seguido de oração
// ("quando sair do trabalho", "se não chover", "once the boss approves", "after I wake up"), advérbio
// vago ("em breve", "uma hora dessas", "soonish", "-ish") e borda aproximada de período ("lá pro fim do
// ano"). Lê o que sobrou: "antes de [sexta]" e "before [the 15th]" o parser já levou. "antes de
// dormir" e "before bed" são rotina, quase um período — ficam no título.
const CHECK_VERB = String.raw`(?:ver|ve|veja|checar|cheque|saber|perguntar|pergunta|pergunte|confirmar|conferir|olhar|verificar|descobrir|testar|see|check|ask|know|confirm|find\s+out|wonder|whether)`;
const VAGUE_RE = new RegExp(
  [
    String.raw`\b(?:algum\s+dia|alguma\s+hora|qualquer\s+(?:dia|hora|momento)|um\s+dia\s+desses|uma\s+hora\s+dessas|(?:em\s+)?algum\s+momento|em\s+breve|logo\s+(?:logo|mais)|mais\s+pra\s+frente|mais\s+adiante|sem\s+pressa|meados|na\s+volta\s+d[aeo]s?|a\s+caminho\s+d[aeo]s?|on\s+the\s+way\s+(?:home|back|to)|(?:la|ali)\s+por|assim\s+que\s+(?:der|puder)|quando\s+(?:der|puder)|talvez|quem\s+sabe)\b`,
    String.raw`(?<!\b(?:o|um|do|no|novo|meu|seu|nosso|esse|the|a|new|our|my)\s+)\blogo\s*$|(?:^|\s)depois\s*$`,
    String.raw`\b(?:daqui\s+(?:a\s+)?(?:uns|umas|alguns|algumas|poucos)|(?:uns|umas|alguns|algumas|poucos)\s+dias|(?:la|ali)\s+(?:pr[oa]s?|pel[oa]s?|perto\s+d[oa])\s+(?!\d))`,
    String.raw`\b(?:comeco|inicio|meio|fim|final)\s+d[oa]\s+(?:ano|semana|mes)?(?=\s|$)|\b(?:beginning|middle|end)\s+of(?:\s+the)?\s+(?:year|\s)|\b(?:early|mid|late)\s+(?:next\s+)?(?:week|month|year)\b|(?<!(?:days?|weeks?|hours?|minutes?|mins?)\s+)\b(?:early|mid)\s*$`,
    String.raw`\b(?:(?:soon|later)ish|sometime|someday|some\s+day|whenever|soon|eventually|maybe|perhaps|at\s+some\s+point|one\s+of\s+these\s+days|in\s+a\s+(?:few|couple)|ish)\b|\d\s*ish\b|\b\d{1,2}\s+(?:or|ou)\s+\d{1,2}\b`,
    String.raw`\b(?:assim|logo|depois|antes|ate|sempre|desde)\s+que\b(?!\s+possivel)|\benquanto\b|\bquando\s+(?!(?:e|eh|vence|sera|foi|tenho|tem|vai|comeca|termina|acaba)\b)[a-z]`,
    String.raw`(?<!\b${CHECK_VERB}\s+(?:\S+\s+){0,2})(?<![a-z](?:ar|er|ir)\s+|\b(?:de|pra|para|a|ao)\s+)\bse\s+(?:nao|n|eu|ele|ela|a\s+gente|voce|vc|o|a|os|as|meu|minha|[a-z]+r)\b`,
    String.raw`(?<!\b(?:o|um|do|no|esse|este|meu|seu|pelo|ao|de|neste|nesse)\s+)\bcaso\b(?!\s+(?:de|do|da|dos|das|clinico)\b)`,
    String.raw`(?<!\b(?:${CHECK_VERB}|what|as|even)\s+(?:\S+\s+){0,2})\bif\b|\bunless\b|\bas\s+soon\s+as\b|\bonce\s+(?:the|i|we|you|he|she|they|it|my|our|his|her|their)\b|\bwhen\s+(?!(?:is|s|do|does|did|am|are|was|will|can|should)\b)[a-z]`,
    String.raw`\b(?:depois|antes)\s+d[ao]s?\s+(?!amanha|almoco|janta|manha)\w+|\b(?:depois|antes)\s+de\s+(?!(?:amanha|dormir|deitar|acordar|almocar|jantar)\b)[a-z]+(?:ar|er|ir)\b|\bapos\s+(?:o|a|os|as|[a-z]+(?:ar|er|ir))\b|\b(?:antes|depois)\s+d[oa]\s+(?:almoco|janta|jantar|cafe)\s+com\b|\b(?:before|after)\s+(?:lunch|dinner|breakfast)\s+with\b`,
    String.raw`\bafter\s+(?:the|my|our|i|we|you|he|she|they|it|work|school|class|[a-z]+ing)\b|\b(?:before|until|till)\s+(?:the|my|our|i|we|you|he|she|they|it|winter|summer|spring|fall|christmas)\b`,
  ].join("|"),
);
// "ligar mais tarde" sem hora quer uma hora de hoje; "asap" e "read later" não querem data nenhuma.
const LATER_RE = /\bmais\s+tarde\b/;
// "uma hora dessas" tem uma hora dentro, que o detector de hora leva.
const VAGUE_IDIOM_RE = /\b(?:uma\s+hora\s+dessas|um\s+dia\s+desses)\b/;
const OR_RE = /\b(?:ou|or)\b/;

// Ponto entre dois números ("17.11", "23.11") é data em pt e hora em todo lugar.
const DOTTED_RE = /(?<!(?:versao|version|v|r\$|\$)\s*)(?<![\d.])\b(\d{1,2})\.(\d{2})\b(?![.,]?\d)/;
const MILITARY_RE =
  /(?<!\b(?:av|avenida|rua|r|alameda|travessa|estrada|rodovia)\.?\s+(?:\S+\s+){0,3})(?<!(?:as|at|@|pelas|by|#|apto?|sala|bloco|casa|room|suite|unit|n|no|numero)\s*)(?<![\d.,:/$]|\d\s)\b([01]\d|2[0-3])([0-5]\d)\b(?![.,:/]\d|\s\d)/;
const SPACED_CLOCK_RE =
  /(?<![\d.,:/])\b([01]?\d|2[0-3])\s+([0-5]\d)\b(?!\s*(?:\d|h\b|min|horas?|hours?|[ap]m\b))/;
// "reunião 3", "treino 6 30", "comprar 2 pizzas 8": número solto no fim do que sobrou, sem unidade
// nem conector — hora, quantidade ou dia? Rótulo antes ("capítulo 3", "sala 12") e nome com
// maiúscula ("iPhone 15", "Fifa 24") dizem que é parte do título.
const BARE_NUMBER_RE =
  /(?<=[a-z]{3,}\s+)(?<!\b(?:n|no|num|numero|nº|sala|apto?|apartamento|bloco|andar|casa|lote|quadra|rua|av|cap|capitulo|pagina|pag|pg|p|aula|modulo|lista|item|questao|exercicio|ex|licao|unidade|fase|nivel|versao|v|ep|episodio|temporada|parte|vol|volume|turma|serie|ano|onibus|linha|portao|vaga|mesa|top|room|unit|suite|floor|level|lesson|chapter|page|season|episode|part|week|semana|day|grade|gate|table|bus|route|step|passo|round|game|jogo|tabela|track|faixa|aro|tamanho|size|quarto|parcela|prestacao|for|para|pra|pras|de|com|with|of|by)\s+)\b(?:1?\d|2[0-4])(?:\s+\d{1,2})?(?=[\s.,!?]*$)/;
const SLASHED_RE = /(?<![\d/])\b(\d{1,2})\/(\d{1,2})\b(?!\/)/;

// O que sobrou no título e tem cara de tempo — o detector não leu, ou leu e largou um pedaço.
const LEFTOVER_RE = new RegExp(
  [
    String.raw`\b(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:\s*feira)?s?\b(?!\s+(?:via|chamada|vez|opcao|mao)\b)|\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b`,
    String.raw`\b(?:janeiro|fevereiro|abril|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|april|june|july|august|september|october|november|december)\b`,
    String.raw`\b\d{1,3}\s*(?:h|hs|hrs?|horas?|hours?|min|mins|minutos?|minutes?)\b`,
    String.raw`\b(?:cada|every|quinzen\w*|biweekly|que\s+vem|ate\s+(?:o|a)\s+(?:fim|final|dia)|next\s+(?:week|month|year))\b|\bsim\s+\w+\s+nao\b`,
    String.raw`\b(?!24\/7\b)\d{1,2}\/\d{1,2}\b|\b\d{1,2}h\d{0,2}\b|(?<=\b(?:as|at)\s+)\d{1,2}\b`,
  ].join("|"),
);

const LEFTOVER_GLOBAL_RE = new RegExp(LEFTOVER_RE.source, "g");

const DANGLING_END_RE =
  /(?:^|\s)(?:e|ou|and|or|to|pra|para|pro|das|dos|from|for|until|till|after|depois|antes|before|entre|between|ate|as|at|ao|aos)[\s,.;:!?]*$/;
const DANGLING_START_RE = /^\s*(?:e|ou|and|or|to|pra|para|ate|until)\s/;

/** "hoje às 8" às 14h: hoje foi pedido com todas as letras — não é dúvida. "ontem pagar boleto" é. */
const ASKED_PAST_RE = /\b(?:hoje|hj|today|tonight|this\s+(?:morning|afternoon|evening))\b/;
const match = (re: RegExp, text: string) => {
  const found = text.match(re);
  return found ? spanOf(found) : null;
};

export function unsureOf({
  input,
  normalized,
  rest,
  visible,
  title,
  consumed,
  date,
  hasTime,
  repeat,
  now,
}: UnsureInput): Unsure[] {
  const out: Unsure[] = [];
  const flag = (code: UnsureCode, span?: Span | null) => out.push(span ? { code, span } : { code });

  const lead = match(QUESTION_LEAD_RE, normalized);
  const tail = input.match(QUESTION_TAIL_RE);
  if (lead && !CLAUSE_BREAK_RE.test(input)) flag("question", lead);
  else if (tail && !CLAUSE_BREAK_RE.test(input.slice(0, tail.index))) flag("question");

  const read = rest === null ? [] : readStarts(visible, rest);
  if (
    SCHEDULE_VERB_RE.test(normalized) ||
    (EDIT_VERB_RE.test(normalized) && SCHEDULE_REF_RE.test(normalized)) ||
    (REMOVE_VERB_RE.test(normalized) && date) ||
    (MOVE_RE.test(normalized) && read.some((start) => TARGET_RE.test(visible.slice(0, start))))
  ) {
    flag("command");
  }

  // "entre 14h e 15h" é intervalo, não lista.
  const listed = normalized.match(LIST_VALUES_RE);
  const list =
    listed !== null && !/\b(?:entre|between)\s+$/.test(normalized.slice(0, listed.index));
  const clauses = normalize(title);
  const english = new RegExp(`^\\s*(?:${EN_VERB})\\b`).test(clauses) && !PT_WORD_RE.test(clauses);
  const verbs = clauses.match(english ? TWO_EN_VERBS_RE : TWO_VERBS_RE);
  const realVerbs =
    verbs &&
    [...verbs[0].matchAll(new RegExp(String.raw`\b${VERB}\b`, "g"))]
      .map(([word]) => word)
      .filter((word) => !NOT_VERB_RE.test(word)).length >= 2;
  if (/[;\n]/.test(input.trim()) || realVerbs || CHAIN_RE.test(clauses) || LIST_RE.test(input)) {
    flag("multi");
  } else if (rest !== null && !list && twoTimedClauses(visible, rest, input, now)) flag("multi");

  if (list) flag("list-values", spanOf(listed));

  const hint = rest === null ? null : match(REPEAT_HINT_RE, rest);
  if (rest === null || (hint && !(date && DOC_PERIOD_RE.test(rest)))) {
    flag("repeat-unsupported", hint);
  }

  const alert = match(ALERT_RE, normalized);
  if (alert) flag("alert", alert);
  const vague =
    match(VAGUE_RE, rest ?? normalized) ??
    match(VAGUE_IDIOM_RE, normalized) ??
    (hasTime ? null : match(LATER_RE, rest ?? normalized));
  // "ler Quando Nietzsche Chorou", "watch When Harry Met Sally": conector com maiúscula no meio é nome.
  const named = vague && vague[0] > input.search(/\S/) && /\p{Lu}/u.test(input[vague[0]]);
  if (vague && !named) flag("vague", vague);
  else if (rest !== null && consumed && OR_RE.test(rest)) {
    flag("vague", match(OR_RE, rest));
  }

  const number = ambiguousNumber(input, normalized, rest ?? normalized, consumed);
  if (number) flag("ambiguous-number", number);

  const word = rest === null ? null : ambiguousWord(visible, rest);
  if (word) flag("ambiguous-word", word);

  if (rest !== null) {
    const leftover = leftoverIn(rest, input, now);
    if (leftover) flag("leftover", leftover);
    // "reunião amanhã a s 10": o "às" partido deixou a hora sem conector.
    else if (consumed && /\b[a-z]\s+\d{1,2}\s*$/i.test(title)) flag("leftover");
    // Só o corte de tempo deixa conector órfão: "comparar bit.ly/a e forms.gle/b" é o título.
    const timeless = normalized
      .split("")
      .map((char, i) => (visible[i] !== " " && rest[i] === " " ? " " : char))
      .join("")
      .trim();
    const dangles = (text: string) => DANGLING_END_RE.test(text) || DANGLING_START_RE.test(text);
    if (consumed && dangles(title) && dangles(timeless)) flag("dangling");
  }

  if (date && repeat === "Off" && !ASKED_PAST_RE.test(normalized)) {
    if (hasTime ? date < now : date < startOfDay(now)) flag("past");
  }

  if (normalized.split(/\s+/).filter(Boolean).length > 15) flag("long");

  return out.filter(({ code }, i) => out.findIndex((other) => other.code === code) === i);
}

/** Onde começa cada trecho que os detectores de tempo leram. */
function readStarts(visible: string, rest: string): number[] {
  const read = (i: number) => visible[i] !== " " && rest[i] === " ";
  return [...visible].flatMap((_, i) => (read(i) && !read(i - 1) ? [i] : []));
}

/**
 * "pagar luz amanhã e água sexta", "gym 7am, dentist 2pm": mais de uma oração com tempo e palavras
 * próprias. Só corta nos separadores que sobraram — o "e" de "três e meia" foi consumido.
 */
function twoTimedClauses(visible: string, rest: string, input: string, now: Date): boolean {
  const cuts = [...rest.matchAll(/,|\s(?:e|and|mas|but)\s/g)].map((hit) => hit.index ?? 0);
  const bounds = [0, ...cuts, visible.length];
  let timed = 0;
  for (let i = 1; i < bounds.length; i++) {
    const [start, end] = [bounds[i - 1], bounds[i]];
    const left = rest.slice(start, end);
    const consumed = visible.slice(start, end).trim() !== left.trim();
    const words = /[a-z]{3,}/.test(left.replace(/^,|\s(?:e|and|mas|but)\s/, " "));
    if (words && (consumed || leftoverIn(left, input.slice(start, end), now))) timed++;
  }
  return timed >= 2;
}

/** `rest`: a hora militar só é dúvida quando ninguém leu ("1730 PT session"); "tomorrow 0900" leu. */
function ambiguousNumber(
  input: string,
  normalized: string,
  rest: string,
  consumed: boolean,
): Span | null {
  const dotted = normalized.match(DOTTED_RE);
  if (dotted) {
    const [a, b] = [Number(dotted[1]), Number(dotted[2])];
    const asDate = (a <= 31 && b >= 1 && b <= 12) || (a >= 1 && a <= 12 && b <= 31);
    if (asDate && a <= 23 && b < 60) return spanOf(dotted);
  }
  const military = rest.match(MILITARY_RE);
  if (military && !/^(?:19|20)/.test(military[0])) return spanOf(military);
  const spaced = normalized.match(SPACED_CLOCK_RE);
  // "14 30" com espaço de verdade — "2026-12-15" também vira "2026 12 15" no normalize.
  if (spaced && consumed && /^\d+\s+\d+$/.test(input.slice(...spanOf(spaced)))) {
    return spanOf(spaced);
  }
  const bare = rest.trimEnd().match(BARE_NUMBER_RE);
  if (bare && !/\p{Lu}/u.test(input.slice(0, bare.index).trimEnd().split(/\s+/).at(-1) ?? "")) {
    return spanOf(bare);
  }
  // 12/1 é 12 de janeiro pro parser (pt) e 1º de dezembro pra quem escreve em inglês.
  const slashed = normalized.match(SLASHED_RE);
  if (slashed && EN_MARKER_RE.test(normalized)) {
    const [a, b] = [Number(slashed[1]), Number(slashed[2])];
    if (a !== b && a <= 12 && b <= 12) return spanOf(slashed);
  }
  return null;
}

// "ter levar o dog" (dia ou "ter que"?) e "nove e quinze" sem "às" (hora ou contagem?): o parser
// leu pela borda da frase ou pelo formato, sem preposição nem unidade — a outra leitura segue de pé.
const OPENING_WEEKDAY_RE = /^\s*(ter|sex|dom)\s+[a-z]{2,}(?:ar|er|ir)\b/;
const BARE_CLOCK_WORDS_RE = new RegExp(
  `(?<!\\b(?:as|at|pelas|das|from|until)\\s+)\\b(?:${HOUR_WORD_RE})\\s+e\\s+(?:meia|quinze|trinta|dez|vinte|cinco)\\b`,
);

function ambiguousWord(visible: string, rest: string): Span | null {
  const read = (i: number) => rest[i] === " " && visible[i] !== " ";
  const opening = visible.match(OPENING_WEEKDAY_RE);
  const start = opening ? opening[0].indexOf(opening[1]) : -1;
  if (opening && read(start)) return [start, start + opening[1].length];
  const clock = visible.match(BARE_CLOCK_WORDS_RE);
  return clock && read(clock.index ?? 0) ? spanOf(clock) : null;
}

const NAMED_DAY_RE = /\b(?:black\s+friday|cyber\s+monday)\b/g;

function leftoverIn(seen: string, input: string, now: Date): Span | null {
  const rest = seen.replace(NAMED_DAY_RE, (name) => " ".repeat(name.length));
  const again =
    parseWhen(rest, now)?.spans[0] ??
    parseDuration(rest, input)?.spans[0] ??
    parseRepeat(rest, now, input)?.spans[0];
  if (again) return again;
  // "call April", "read Tuesdays with Morrie": nome com maiúscula que o parser largou de propósito.
  const found = [...rest.matchAll(LEFTOVER_GLOBAL_RE)].find(
    (hit) => !/^\p{Lu}\p{Ll}/u.test(input.slice(hit.index ?? 0)),
  );
  return found ? spanOf(found) : null;
}
