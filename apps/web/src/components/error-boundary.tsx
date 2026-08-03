import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors in the routed tree and shows a themed fallback
 * instead of white-screening the whole route. React error boundaries must be
 * class components. Lives inside ThemeProvider so the fallback uses tokens.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Algo deu errado</h1>
        <p className="max-w-md text-muted-foreground">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
    );
  }
}
