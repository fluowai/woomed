import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    (this as any).props.onError?.(error, errorInfo);
  }

  render() {
    const p = (this as any).props as Props;
    if (this.state.hasError) {
      if (p.fallback) return p.fallback;
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg">
            <h3 className="text-xl font-black text-slate-900 mb-2">Algo deu errado</h3>
            <p className="text-slate-500 font-medium mb-4">{this.state.error?.message || 'Erro inesperado ao carregar este modulo.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors"
            >
              Recarregar pagina
            </button>
          </div>
        </div>
      );
    }
    return p.children;
  }
}
