import { useState } from "react";
import { LinkIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkLabel } from "@/functions/link-label";
import { parseLinks } from "@/functions/parse-links";

const MAX_LINKS = 10; // igual ao teto da rota; passar disso volta 400 do servidor
const MAX_URL_LEN = 2048; // idem — mesmo teto de apps/server/src/routes/tasks.ts

/**
 * A mesma regra do detector do composer decide o que é URL aqui — sem segunda definição.
 * `parseLinks` não cobre tamanho nem credencial embutida quando o esquema é explícito (fica pra
 * validação do servidor, por design dele) — replicados aqui pra não estourar um 400 só no salvar.
 */
export function normalizeUrl(raw: string): string | null {
  const { urls } = parseLinks(raw.trim());
  if (urls.length !== 1) return null;
  const [url] = urls;
  if (url.length > MAX_URL_LEN) return null;
  const { username, password } = new URL(url);
  if (username || password) return null;
  return url;
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-md border border-surface-line px-2 py-1 " +
  "font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground";

export function LinksField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (links: string[]) => void;
}): JSX.Element {
  // índice em edição, ou "new" pro input de adicionar; null = nenhum input aberto
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

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
    onChange(editing === "new" ? [...value, url] : value.map((v, i) => (i === editing ? url : v)));
    setEditing(null);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
              if (e.key === "Escape") setEditing(null);
            }}
            aria-label={copy.form.linkEdit}
            aria-invalid={invalid}
            title={invalid ? copy.form.linkInvalid : undefined}
            className="h-8 w-64"
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
            if (e.key === "Escape") setEditing(null);
          }}
          aria-label={copy.form.linkAdd}
          aria-invalid={invalid}
          title={invalid ? copy.form.linkInvalid : undefined}
          className="h-8 w-64"
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
