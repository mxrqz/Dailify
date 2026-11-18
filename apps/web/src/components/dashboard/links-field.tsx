import { useState, type ComponentProps } from "react";
import { LinkIcon, Trash2Icon, VideoIcon, XIcon } from "lucide-react";

import { TASK_LIMITS, meetLink, parseLinks } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A régua é uma só (`@dailify/shared`): estes dois números eram cópia do servidor, com o
// comentário apontando pra um arquivo que o refactor já tinha movido.
const { urlMax: MAX_URL_LEN } = TASK_LIMITS;

const iconButtonClass =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-fast hover:bg-fill hover:text-ink";

// The error shows on the border (and title), not on a line below, so the panel never grows.
function UrlInput({
  invalid,
  error,
  className,
  ...props
}: ComponentProps<typeof Input> & { invalid: boolean; error: string }) {
  return (
    <Input
      autoFocus
      maxLength={MAX_URL_LEN}
      aria-invalid={invalid}
      title={invalid ? error : undefined}
      className={cn(
        "h-10 min-w-0 flex-1 truncate border-separator focus-visible:border-brand-text focus-visible:ring-0",
        invalid && "border-brand-text",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A mesma regra do detector do composer decide o que é URL aqui — sem segunda definição.
 * `parseLinks` não cobre tamanho nem credencial embutida quando o esquema é explícito (fica pra
 * validação do servidor, por design dele) — replicados aqui pra não estourar um 400 só no salvar.
 */
export function normalizeUrl(raw: string): string | null {
  const input = raw.trim();
  const { urls } = parseLinks(input);
  if (urls.length !== 1) return null;
  // `parseLinks` apara pontuação final porque no composer a URL vem no meio de prosa ("(veja
  // x.com)"); aqui o campo só recebe URL, então token único com esquema explícito vale inteiro —
  // aparar corromperia ".../Java_(linguagem_de_programação)" e ".../path.".
  const url = /^https?:\/\/\S+$/i.test(input) ? input : urls[0];
  if (url.length > MAX_URL_LEN || !URL.canParse(url)) return null;
  const { username, password } = new URL(url);
  if (username || password) return null;
  return url;
}

/**
 * O link da tarefa — um só. O campo já abre com ele, pronto pra editar; apagar o texto também
 * remove. Cada tecla válida já sobe pro `onChange` (quem guarda salva no fechar, e o blur chegaria
 * tarde); rascunho inválido fica marcado e não sobe.
 */
export function LinksField({
  value,
  onChange,
  labelledBy,
}: {
  value: string[];
  onChange: (links: string[]) => void;
  labelledBy: string;
}): JSX.Element {
  const [draft, setDraft] = useState(value[0] ?? "");
  const [invalid, setInvalid] = useState(false);
  const url = normalizeUrl(draft);

  const change = (next: string) => {
    setDraft(next);
    const normalized = normalizeUrl(next);
    const empty = next.trim() === "";
    setInvalid(!empty && !normalized);
    if (empty) onChange([]);
    else if (normalized) onChange([normalized]);
  };

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-2">
      {/* O ícone abre o link: o campo é pra editar, e um clique nele não pode sair da página. */}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.form.linkOpen}
          className={iconButtonClass}
        >
          <LinkIcon className="size-4" />
        </a>
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center text-ink-secondary">
          <LinkIcon className="size-4" aria-hidden="true" />
        </span>
      )}
      <UrlInput
        value={draft}
        placeholder={copy.form.linkPlaceholder}
        onChange={(e) => change(e.target.value)}
        aria-label={copy.form.links}
        invalid={invalid}
        error={copy.form.linkInvalid}
      />
      {/* Sempre no lugar (invisível sem texto): sumir com ele mudava a largura do campo. */}
      <button
        type="button"
        aria-label={copy.form.linkRemove}
        onClick={() => change("")}
        className={cn(iconButtonClass, !draft && "invisible")}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

/**
 * O Meet de uma tarefa da Agenda: colar outro link troca a sala (sobe a cada tecla válida, como o
 * `LinksField`, e vai pro evento no salvar); gerar e remover são as linhas embaixo.
 */
export function MeetEditor({
  value,
  onChange,
  onNew,
  onRemove,
  pending,
}: {
  value: string;
  onChange: (url: string) => void;
  onNew: () => void;
  onRemove: () => void;
  pending?: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  const change = (next: string) => {
    setDraft(next);
    const url = normalizeUrl(next);
    const meet = url && meetLink([url]);
    setInvalid(!meet);
    if (meet) onChange(meet);
  };

  return (
    <div className="flex flex-col gap-3">
      <ListGroup compact footer={copy.form.meetHint}>
        <div className="flex items-center gap-2 px-3.5 py-1.5">
          <VideoIcon className="size-4 shrink-0 text-ink-secondary" aria-hidden="true" />
          <UrlInput
            value={draft}
            placeholder={copy.form.meetPlaceholder}
            onChange={(e) => change(e.target.value)}
            aria-label={copy.form.meet}
            invalid={invalid}
            error={copy.form.meetInvalid}
          />
        </div>
      </ListGroup>
      <ListGroup compact>
        <ListRow
          icon={<VideoIcon />}
          label={copy.form.meetNew}
          onClick={onNew}
          disabled={pending}
        />
        <ListRow
          icon={<Trash2Icon />}
          label={copy.form.meetRemove}
          danger
          onClick={onRemove}
          disabled={pending}
        />
      </ListGroup>
    </div>
  );
}
