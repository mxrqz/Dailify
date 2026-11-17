import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";

import { OverlayClose } from "@/components/ui/dialog";
import { spring } from "@/consts/motion";
import { cn } from "@/lib/utils";

// Soltar fecha a folha depois de um quarto da altura, ou num empurrão pra baixo (px/s).
const CLOSE_FRACTION = 0.25;
const CLOSE_VELOCITY = 500;
// Pra cima ela só cede um pouco: 10% do que o dedo andou.
const RESISTANCE = 0.1;

const FIELDS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]';

/**
 * O arrasto começa em qualquer ponto do painel, menos num campo (lá o dedo seleciona texto) e numa
 * lista já rolada (lá ele rola de volta). No topo dela, puxar pra baixo fecha e pra cima rola: o
 * navegador toma o gesto da lista e cancela o arrasto.
 */
export function canDragSheet(target: EventTarget | null, panel: Element): boolean {
  // Um diálogo aberto de dentro da folha mora num portal, mas o evento borbulha até ela pelo React.
  if (!(target instanceof Element) || !panel.contains(target) || target.closest(FIELDS))
    return false;
  for (let el: Element | null = target; el && el !== panel; el = el.parentElement)
    if (el.scrollTop > 0) return false;
  return true;
}

export function shouldCloseSheet(offset: number, velocity: number, height: number): boolean {
  return offset > height * CLOSE_FRACTION || (offset > 0 && velocity > CLOSE_VELOCITY);
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

/**
 * A opacidade acompanha o arrasto da folha: é do próprio scrim, nunca de um ancestral do vidro. O
 * ref é do Presence do portal: sem ele o scrim sumia num quadro em vez de sair junto do painel.
 */
const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  { opacity: MotionValue<number>; className: string }
>(({ opacity, className }, ref) => (
  <SheetPrimitive.Overlay ref={ref} asChild>
    <motion.div
      data-slot="sheet-overlay"
      style={{ opacity }}
      className={cn(
        "scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:duration-base fixed inset-0 z-50",
        className,
      )}
    />
  </SheetPrimitive.Overlay>
));

/**
 * Vidro que entra pela borda: `bottom` é a folha do iOS (topo de 32px + puxador), `left` a gaveta
 * do menu. Só `transform` anima, no próprio painel; overflow fica num filho (aqui cortaria o fio de
 * luz da borda de cima).
 *
 * A de baixo fecha puxada pra baixo de qualquer ponto (`canDragSheet`). O `y` fica onde o dedo
 * largou e a saída do CSS (`slide-out`, só com o `to`) parte dali, sem salto; solta já andando, a
 * saída é `ease-out` (a `ease-exit` arrancaria do zero e o painel engasgaria).
 */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const bottom = side === "bottom";
  // The drawer closes dragged left, the same rule mirrored on x.
  const left = side === "left";
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const shift = useMotionValue(0);
  const size = React.useRef(0);
  const scrim = useTransform(shift, (value) => {
    const pulled = left ? -value : value;
    return pulled > 0 ? 1 - pulled / size.current : 1;
  });
  // O fechar do próprio Radix: passa pelo onOpenChange de quem abriu, como o Esc e o X.
  const close = React.useRef<HTMLButtonElement>(null);
  const [flung, setFlung] = React.useState(false);
  const exit = flung ? "data-[state=closed]:ease-out" : "data-[state=closed]:ease-exit";

  return (
    <SheetPortal>
      <SheetOverlay opacity={scrim} className={exit} />
      <SheetPrimitive.Content
        asChild
        // Depois que a folha saiu de vez: zera o deslocamento que o arrasto deixou, pra próxima abrir no lugar.
        onCloseAutoFocus={(event) => {
          shift.jump(0);
          setFlung(false);
          onCloseAutoFocus?.(event);
        }}
        {...props}
      >
        <motion.div
          data-slot="sheet-content"
          style={left ? { x: shift } : { y: shift }}
          drag={bottom ? "y" : left && "x"}
          dragControls={controls}
          dragListener={false}
          dragDirectionLock
          dragMomentum={false}
          dragConstraints={left ? { right: 0 } : { top: 0 }}
          dragElastic={RESISTANCE}
          onPointerDown={(event) => {
            if (!(bottom || left) || event.button !== 0) return;
            // The drawer pans y natively (touch-pan-y), so a scrolled nav doesn't block closing.
            if (bottom && !canDragSheet(event.target, event.currentTarget)) return;
            size.current = left
              ? event.currentTarget.offsetWidth
              : event.currentTarget.offsetHeight;
            controls.start(event);
          }}
          // ponytail: quem recusar o fechamento deixa a folha onde o dedo largou; aí, animate(shift, 0).
          onDragEnd={(_, { offset, velocity }) => {
            const [moved, speed] = left ? [-offset.x, -velocity.x] : [offset.y, velocity.y];
            if (shouldCloseSheet(moved, speed, size.current)) {
              setFlung(true);
              close.current?.click();
            } else void animate(shift, 0, reduce ? { duration: 0 } : spring.snappy);
          }}
          className={cn(
            "glass text-ink fixed z-50 flex flex-col data-[state=open]:animate-in data-[state=open]:duration-slow data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:duration-base",
            exit,
            side === "right" &&
              "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full inset-y-0 right-0 h-full w-3/4 rounded-l-sheet sm:max-w-sm",
            side === "left" &&
              "data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-left-full inset-y-0 left-0 h-full w-76 max-w-5/6 touch-pan-y transition-none rounded-r-sheet px-3 pt-safe pb-safe",
            side === "top" &&
              "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full inset-x-0 top-0 h-auto rounded-b-sheet",
            // pan-x: o que o motion poria sozinho com `drag="y"` (o `dragListener={false}` tira).
            // transition-none: o `duration-*` também é transition-duration, e com o `all` padrão o
            // painel seguiria o dedo atrasado 300ms.
            side === "bottom" &&
              "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full inset-x-0 bottom-0 h-auto touch-pan-x transition-none rounded-t-sheet px-4 pb-safe",
            className,
          )}
        >
          {bottom && (
            <div
              className="mx-auto mt-2 h-1.25 w-9 shrink-0 rounded-full bg-fill-pressed"
              aria-hidden="true"
            />
          )}
          {children}
          {showCloseButton && (
            <OverlayClose
              plain={!bottom}
              className={bottom ? "top-4.5 right-3" : "top-safe right-3"}
            />
          )}
          {(bottom || left) && <SheetPrimitive.Close ref={close} hidden />}
        </motion.div>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 px-1 pt-3 pr-10 pb-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-1 pt-5", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-title-3 font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-ink-secondary text-subhead", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
