import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botões do DS: primário em `brand`, secundário em `fill`, ghost e o vermelho suave
 * (`soft-danger`, o "Encerrar"). O raio cresce com a altura: 32–44px → radius-sm, 52px → radius-md.
 * `outline` é legado (só tokens); em tela nova prefira `secondary`.
 */
const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap font-semibold transition-[color,background-color,border-color,box-shadow,scale] duration-fast active:scale-97 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
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
  React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
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
