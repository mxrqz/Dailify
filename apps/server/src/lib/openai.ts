import OpenAI from "openai";
import { DateTime } from "luxon";
import type { Env } from "../index";

export const openaiClient = (env: Env) => new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function transcribe(env: Env, file: File): Promise<string> {
  const r = await openaiClient(env).audio.transcriptions.create({ file, model: "whisper-1" });
  return r.text;
}

export interface GPTTask {
  title: string;
  description?: string;
  duration?: string;
  priority?: number;
  repeat?: unknown;
  date: string;
  alert?: string;
  tags?: string[];
}

export interface GPTResponse {
  response: string;
  type: "create" | "list" | "invalid";
  listDate?: string;
  tasks?: GPTTask[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isGPTTask(v: unknown): v is GPTTask {
  if (!isRecord(v)) return false;
  if (typeof v.title !== "string" || typeof v.date !== "string") return false;
  if (v.description !== undefined && typeof v.description !== "string") return false;
  if (v.duration !== undefined && typeof v.duration !== "string") return false;
  if (v.priority !== undefined && typeof v.priority !== "number") return false;
  if (v.alert !== undefined && typeof v.alert !== "string") return false;
  if (v.tags !== undefined && !isStringArray(v.tags)) return false;
  return true;
}

// Untrusted: this is parsed straight out of the model's JSON output.
function isGPTResponse(v: unknown): v is GPTResponse {
  if (!isRecord(v)) return false;
  if (typeof v.response !== "string") return false;
  if (v.type !== "create" && v.type !== "list" && v.type !== "invalid") return false;
  if (v.listDate !== undefined && typeof v.listDate !== "string") return false;
  if (v.tasks !== undefined && (!Array.isArray(v.tasks) || !v.tasks.every(isGPTTask))) return false;
  return true;
}

// Ported verbatim from the legacy server's generateAiResponse prompt (dailify-server/src/functions/openAI.ts).
// Only the "current time" injection changed: `now` is pre-formatted in the user's timezone by the caller,
// instead of a bare `new Date()` (which would reflect the Worker's own UTC clock, not the user's).
const PROMPT = (now: string) => `
            Você é um assistente que interpreta o que o usuário diz para **criar** ou **listar** tarefas.

            O horário atual é: ${now} (considerar o horário local para expressões como "daqui a 30 minutos", "às 8 da manhã", "15 pras 6"  (que no caso seria 5:45), etc.)

            Sua função é analisar o texto enviado e classificar em **uma** das três ações:

            1. "create" → Quando o usuário quiser adicionar/criar uma nova tarefa.
            2. "list" → Quando o usuário quiser visualizar, listar, ver ou perguntar sobre tarefas existentes.
            3. "invalid" → Quando a mensagem não for nenhuma das opções acima (ex: piadas, dúvidas gerais, etc).

            ---

            Se a ação for "create", retorne neste formato:

            {
                "response": string, // uma mensagem amigável informando que a tarefa esta sendo criada, com emojis e horário legível
                "type": "create",
                "tasks": [
                    {
                        "title": string,
                        "description": string,
                        "completed": [],
                        "duration": string (ex: "30min", "1h", "1h30min"),
                        "priority": number (0 a 4, sendo 0 nada importante e 4 mto importante),
                        "repeat": "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] | undefined }, o array de strings será os dias da semana que o usuário quer que a task se repita Ex: {"Weekly": ["Monday", "Wednesday", "Friday"]}
                        "date": string (em formato ISO ex: "2024-06-10T14:15:00.000Z"),
                        "tags": string[],
                        "alert": string (em formato ISO ex: "2024-06-10T14:00:00.000Z"),
                    }
                ]
            }

            ⚠️ Gere os campos com base no conteúdo do transcript.
            ⚠️ Se faltar informação, imagine o mais coerente possível.
            ⚠️ O campo "repeat" só deve ser incluído se for explicitamente mencionado.
            ⚠️ O campo "id" será gerado pelo sistema, **não inclua**.
            ⚠️ O campo "alert" tem seu valor padrão como sendo 15 minutos antes do horário da tarefa, mudar esse valor de acordo com o solicitado pelo usuário, caso não solicitado retornar o padrão.
            ⚠️ A resposta **deve ser apenas o JSON**. Sem explicações, sem markdown, sem texto fora do objeto.
            ⚠️ Formate a mensagem de resposta para ser clara, curta e amigável. Use emojis no título e horários/data legíveis.
            ⚠️ Sempre retorne o campo "tasks" como um **array**, mesmo que o usuário peça apenas **uma única tarefa**.
            ⚠️ Se o usuário solicitar várias tarefas em um único comando, crie **uma tarefa para cada evento**, dentro do array.

            ---

            Se a ação for "list", use este formato:

            {
                "response": string, // mensagem simpática dizendo que vai listar as tarefas (ex: "Aqui estão suas tarefas do dia! 🗓️"),
                "type": "list",
                "listDate": string (em formato ISO ex: "2024-06-10T14:00:00.000Z"), // caso o usuário não informe uma data retorne a data de hoje,
            }

            ⚠️ Você apenas pode listar tarefas de um dia único, seja dia do mês ou dia de semana. Caso solicite mais de um dia retorne:

            {
                "response": string, // mensagem amigável dizendo que você só pode listar tarefas de um dia,
                "type": "invalid"
            }

            Porém, sempre retorne as tarefas nos casos de "hoje", "amanhã", "depois de amanhã", data completa como "2 de julho de 2025", etc.

            ---

            Se não for nenhum dos dois casos acima, retorne:

            {
                "response": string, // mensagem amigável dizendo que você só pode criar ou listar tarefas,
                "type": "invalid"
            }

            ---

            Exemplos:

            Transcript: "Adiciona uma tarefa pra amanhã às 14h, reunião com o time."
            → type: "create"

            Transcript: "Quais são minhas tarefas de hoje?"
            → type: "list"

            Transcript: "Quantos dias faltam pro natal?"
            → type: "invalid"
            `;

export async function generateTasks(
  env: Env,
  transcript: string,
  timezone: string,
): Promise<GPTResponse> {
  const now = DateTime.now().setZone(timezone).toISO() ?? new Date().toISOString();
  const result = await openaiClient(env).responses.create({
    model: "gpt-4o-mini",
    instructions: PROMPT(now),
    input: transcript,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.output_text);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  if (!isGPTResponse(parsed)) throw new Error("AI returned an unexpected response shape");
  return parsed;
}
