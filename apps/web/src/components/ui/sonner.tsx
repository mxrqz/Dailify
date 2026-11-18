import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/components/theme-provider";
import { MOBILE } from "@/consts/media";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Interseção com Record: CSSProperties sozinho não aceita custom properties.
const toasterTokens: React.CSSProperties & Record<string, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

/**
 * Editado à mão: o shadcn lê o tema do next-themes, que não tem provider aqui — o toast ficava em
 * "system" mesmo com o app em dark. O CSS do sonner entra sem layer, então só as variáveis dele
 * (inline) e utilitários com `!` vencem a fonte, o raio e a cor da descrição fixos que ele traz.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  // No mobile o rodapé é do polegar, do composer e da nav — o toast lá cobre justamente o que a
  // pessoa acabou de tocar.
  const mobile = useMediaQuery(MOBILE);

  return (
    <Sonner
      position={mobile ? "top-center" : "bottom-right"}
      theme={theme}
      className="toaster group font-sans!"
      style={toasterTokens}
      toastOptions={{
        classNames: { toast: "rounded-md!", description: "text-muted-foreground!" },
      }}
      {...props}
    />
  );
};

export { Toaster };
