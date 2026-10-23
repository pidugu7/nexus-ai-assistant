import React from "react";

interface Props {
  fallback: React.ReactNode;
  onError?: (err: Error) => void;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class CoreErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
