import { useEffect, useRef, useState } from "react";
import { LinkIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { chipClass, fieldClass } from "@/components/dashboard/styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkLabel } from "@/functions/link-label";
import { parseLinks } from "@/functions/parse-links";

const MAX_LINKS = 10; // igual ao teto da rota; passar disso volta 400 do servidor
const MAX_URL_LEN = 2048; // idem — mesmo teto de apps/server/src/routes/tasks.ts

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
      className="flex flex-wrap items-center gap-1.5"
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
          <span key={url} className={chipClass}>
            <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              {linkLabel(url)}
            </a>
            <button
              type="button"
              aria-label={copy.form.linkEdit}
              onClick={() => openEditor(index)}
              className="text-muted-foreground hover:text-foreground"
            >
              <PencilIcon className="size-3" />
            </button>
            <button
              type="button"
              aria-label={copy.form.linkRemove}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="text-muted-foreground hover:text-destructive"
            >
              <XIcon className="size-3" />
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
