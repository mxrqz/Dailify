import { useEffect, useRef, useState } from "react";
import { LinkIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { fieldClass } from "@/components/dashboard/styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkLabel } from "@/functions/link-label";
import { parseLinks } from "@/functions/parse-links";

// A régua é uma só (`@dailify/shared`): estes dois números eram cópia do servidor, com o
// comentário apontando pra um arquivo que o refactor já tinha movido.
const { linksMax: MAX_LINKS, urlMax: MAX_URL_LEN } = TASK_LIMITS;

const inputClass = `h-9 w-64 ${fieldClass}`;

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

/** Mesma regra do composer: URL repetida vira um chip só, e uma linha só no D1. */
export function withLink(links: string[], url: string, at: number | "new"): string[] {
  const next = at === "new" ? [...links, url] : links.map((v, i) => (i === at ? url : v));
  return [...new Set(next)];
}

export function LinksField({
  value,
  onChange,
  labelledBy,
}: {
  value: string[];
  onChange: (links: string[]) => void;
  labelledBy: string;
}): JSX.Element {
  const groupRef = useRef<HTMLDivElement>(null);
  // índice em edição, ou "new" pro input de adicionar; null = nenhum input aberto
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  // O Radix escuta o Escape em `document` na fase de captura, ou seja antes de qualquer handler do
  // React (que ficam no container do portal, `body`) — um `onKeyDown` aqui só rodaria com a Sheet
  // já fechada e a edição inteira perdida. `window` é o primeiro alvo da captura, então este
  // listener chega antes e cancela o evento; o Radix desiste quando ele já vem cancelado.
  useEffect(() => {
    if (editing === null) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!(e.target instanceof Node) || !groupRef.current?.contains(e.target)) return;
      e.preventDefault();
      setEditing(null);
      setDraft("");
      setInvalid(false);
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [editing]);

  const openEditor = (target: number | "new") => {
    setEditing(target);
    setDraft(typeof target === "number" ? value[target] : "");
    setInvalid(false);
  };

  const commit = () => {
    const url = normalizeUrl(draft);
    if (!url) {
      // rascunho vazio (usuario abriu o campo e saiu sem digitar) fecha sem erro; texto
      // realmente invalido fica marcado e o input aberto, pra nao descartar o que a pessoa digitou
      if (draft.trim() === "") {
        setEditing(null);
        setDraft("");
        return;
      }
      setInvalid(true);
      return;
    }
    if (editing !== null) onChange(withLink(value, url, editing));
    setEditing(null);
    setDraft("");
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-col items-start gap-1 py-1.5"
    >
      {value.map((url, index) =>
        editing === index ? (
          <Input
            key={url}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            aria-label={copy.form.linkEdit}
            aria-invalid={invalid}
            title={invalid ? copy.form.linkInvalid : undefined}
            className={inputClass}
          />
        ) : (
          // Link é leitura antes de ser campo: texto sublinhado, como em qualquer lugar da web,
          // com os controles ao lado em vez de um chip que disfarça o que ele é.
          <span key={url} className="group/link flex max-w-full items-center gap-1.5 text-sm">
            <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              className="truncate text-foreground underline decoration-surface-line underline-offset-4 transition-colors hover:decoration-accent-primary"
            >
              {linkLabel(url)}
            </a>
            <button
              type="button"
              aria-label={copy.form.linkEdit}
              onClick={() => openEditor(index)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={copy.form.linkRemove}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        ),
      )}

      {editing === "new" ? (
        <Input
          autoFocus
          value={draft}
          placeholder={copy.form.linkPlaceholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          aria-label={copy.form.linkAdd}
          aria-invalid={invalid}
          title={invalid ? copy.form.linkInvalid : undefined}
          className={inputClass}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={value.length >= MAX_LINKS}
          title={value.length >= MAX_LINKS ? copy.form.linkLimit : undefined}
          onClick={() => openEditor("new")}
          className="h-8 gap-1.5 text-2xs"
        >
          <PlusIcon className="size-3" />
          {copy.form.linkAdd}
        </Button>
      )}
    </div>
  );
}
