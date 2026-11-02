import { useState } from "react";
import { LinkIcon, XIcon } from "lucide-react";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { fieldClass } from "@/components/dashboard/styles";
import { Input } from "@/components/ui/input";
import { parseLinks } from "@/functions/parse-links";
import { cn } from "@/lib/utils";

// A régua é uma só (`@dailify/shared`): estes dois números eram cópia do servidor, com o
// comentário apontando pra um arquivo que o refactor já tinha movido.
const { urlMax: MAX_URL_LEN } = TASK_LIMITS;

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
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <LinkIcon className="size-4" />
        </a>
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
          <LinkIcon className="size-4" aria-hidden="true" />
        </span>
      )}
      <Input
        autoFocus
        value={draft}
        placeholder={copy.form.linkPlaceholder}
        maxLength={MAX_URL_LEN}
        onChange={(e) => change(e.target.value)}
        aria-label={copy.form.links}
        aria-invalid={invalid}
        // Erro na própria borda (e no title), não numa linha embaixo: o painel não cresce nem
        // ganha um respiro desigual só pra guardar lugar pra mensagem.
        title={invalid ? copy.form.linkInvalid : undefined}
        className={cn(
          "h-10 min-w-0 flex-1 truncate",
          fieldClass,
          invalid && "border-destructive focus-visible:border-destructive",
        )}
      />
      {/* Sempre no lugar (invisível sem texto): sumir com ele mudava a largura do campo. */}
      <button
        type="button"
        aria-label={copy.form.linkRemove}
        onClick={() => change("")}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
          !draft && "invisible",
        )}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
