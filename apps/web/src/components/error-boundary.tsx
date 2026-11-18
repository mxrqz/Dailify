import { Component, type ErrorInfo, type ReactNode } from "react";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";

const t = copy.errorBoundary;

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
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
        <h1 className="text-title-1 text-ink">{t.title}</h1>
        <p className="max-w-md text-ink-secondary">{t.description}</p>
        <Button onClick={() => window.location.reload()}>{t.reload}</Button>
      </div>
    );
  }
}
