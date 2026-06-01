import { Component, type ErrorInfo, type ReactNode } from "react";

import { BootstrapScreen } from "./BootstrapScreen";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <BootstrapScreen
          message="Что-то пошло не так"
          error="Обновите Mini App или откройте его заново через @resumeez_bot."
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
