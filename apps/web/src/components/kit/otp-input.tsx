import { type ComponentPropsWithoutRef, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { copy } from "./copy";

const LENGTH = 6;

/**
 * Six boxes drawn over one real input, so the keyboard's one-time-code suggestion and paste fill
 * every box at once. `onComplete` fires on the 6th digit; `error` clears the field and refocuses it.
 */
export function OtpInput({
  onComplete,
  error = false,
  disabled,
  className,
  "aria-label": label = copy.code,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "value" | "defaultValue" | "onChange"> & {
  onComplete: (code: string) => void;
  error?: boolean;
}) {
  const [value, setValue] = useState("");
  const [failed, setFailed] = useState(error);
  const input = useRef<HTMLInputElement>(null);
  // Clear while rendering the error, not in an effect, so the stale code never paints.
  if (error !== failed) {
    setFailed(error);
    if (error) setValue("");
  }
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);
  const accept = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, LENGTH);
    setValue(next);
    if (next.length === LENGTH && next !== value) onComplete(next);
  };

  return (
    <div className={cn("group/otp relative flex items-center justify-center gap-2", className)}>
      {Array.from({ length: LENGTH }, (_, i) => (
        <span key={i} className="contents">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-14 max-w-13 flex-1 items-center justify-center rounded-md bg-fill text-title-3 font-semibold tabular-nums transition-shadow duration-fast",
              i === Math.min(value.length, LENGTH - 1) &&
                "group-focus-within/otp:ring-2 group-focus-within/otp:ring-brand-text group-focus-within/otp:ring-inset",
              error && "ring-2 ring-brand-text ring-inset",
              disabled && "opacity-50",
            )}
          >
            {value[i]}
          </span>
          {i === LENGTH / 2 - 1 && (
            <span aria-hidden="true" className="text-title-3 text-ink-tertiary">
              –
            </span>
          )}
        </span>
      ))}
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        aria-label={label}
        aria-invalid={error || undefined}
        disabled={disabled}
        value={value}
        onChange={(e) => accept(e.target.value)}
        // maxLength would cut "482 913" before the spaces go, so a paste replaces the field
        onPaste={(e) => {
          e.preventDefault();
          accept(e.clipboardData.getData("text"));
        }}
        className="absolute inset-0 size-full text-base text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
        {...props}
      />
    </div>
  );
}
