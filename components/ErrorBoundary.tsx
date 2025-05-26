import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark text-text_primary-light dark:text-text_primary-dark p-4">
          <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-lg shadow-xl border border-danger max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-danger mb-4">Ocorreu um Erro Inesperado</h1>
            <p className="mb-2 text-text_secondary-light dark:text-text_secondary-dark">
              A aplicação encontrou um problema e não pôde continuar. Pedimos desculpas pelo inconveniente.
            </p>
            <p className="mb-4 text-text_secondary-light dark:text-text_secondary-dark">
              Você pode tentar recarregar a página. Se o problema persistir, por favor, verifique o console do navegador (F12) para mais detalhes técnicos.
            </p>
            
            {this.state.error && (
              <details className="mb-4 bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-700">
                <summary className="cursor-pointer font-semibold text-sm text-text_primary-light dark:text-text_primary-dark">Detalhes do Erro (Técnico)</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap overflow-auto max-h-48 text-danger dark:text-danger/90">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack && (
                    <>
                      <br />
                      <br />
                      <strong>Component Stack:</strong>
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReload}
              className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
            >
              Recarregar Página
            </button>
          </div>
          <footer className="text-center p-4 mt-8 text-xs text-text_secondary-light dark:text_text_secondary-dark">
            Fiscal Cripto SMC | Se o problema persistir, considere reportar os detalhes do erro.
          </footer>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
