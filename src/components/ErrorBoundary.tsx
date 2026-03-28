import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-orange-50 dark:bg-gray-900 p-4 transition-colors duration-300">
          <div className="rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-xl max-w-md w-full text-center border border-transparent dark:border-gray-700 transition-colors duration-300">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4 transition-colors duration-300">Oops, something went wrong.</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors duration-300">We encountered an unexpected error.</p>
            <pre className="text-left bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 rounded-lg text-sm overflow-auto max-h-48 mb-6 transition-colors duration-300">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
