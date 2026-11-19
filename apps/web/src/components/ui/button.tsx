import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2Icon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botões do DS: primário em `brand`, secundário em `fill`, ghost e o vermelho suave
 * (`soft-danger`, o "Encerrar"). O raio cresce com a altura: 32–44px → radius-sm, 52px → radius-md.
 * `outline` é legado (só tokens); em tela nova prefira `secondary`.
 * `loading` (not with `asChild`) swaps the label for a spinner but keeps it as the accessible name.
 */
const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap font-semibold transition-[color,background-color,border-color,box-shadow,scale] duration-fast active:scale-97 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 focus-ring focus-visible:border-brand-text aria-invalid:ring-brand-text/20 dark:aria-invalid:ring-brand-text/40 aria-invalid:border-brand-text",
  {
    variants: {
      variant: {
        default: "bg-brand text-on-brand hover:bg-brand-pressed",
        secondary: "bg-fill text-ink hover:bg-fill-pressed",
        ghost: "text-ink hover:bg-fill",
        "soft-danger": "bg-brand-soft text-brand-text hover:bg-brand-soft-pressed",
        outline: "border border-separator bg-transparent text-ink hover:bg-fill",
        link: "text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-footnote has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-4",
        default:
          "h-11 rounded-sm px-4 text-subhead has-[>svg]:px-3.5 [&_svg:not([class*='size-'])]:size-4.5",
        lg: "h-13 rounded-md px-5 text-body [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11 rounded-sm [&_svg:not([class*='size-'])]:size-5",
        // The round icon buttons of a mobile top bar.
        bar: "size-11 rounded-full [&_svg:not([class*='size-'])]:size-5.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }
>(({ className, variant, size, asChild = false, loading = false, ...props }, ref) => {
  if (loading && !asChild) {
    const { children, disabled, ...rest } = props;
    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy="true"
        {...rest}
      >
        <Loader2Icon className="animate-spin" aria-hidden="true" />
        <span className="sr-only">{children}</span>
      </button>
    );
  }
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
