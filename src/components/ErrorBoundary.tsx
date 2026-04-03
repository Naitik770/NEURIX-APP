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
      let errorDetails = this.state.error?.message || 'An unexpected error occurred.';
      let isFirestoreError = false;
      let firestoreInfo: any = null;

      try {
        if (errorDetails.startsWith('{') && errorDetails.endsWith('}')) {
          firestoreInfo = JSON.parse(errorDetails);
          if (firestoreInfo.error && firestoreInfo.operationType) {
            isFirestoreError = true;
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-orange-50 dark:bg-gray-900 p-4 transition-colors duration-300">
          <div className="rounded-3xl bg-white dark:bg-gray-800 p-8 shadow-2xl max-w-lg w-full text-center border border-transparent dark:border-gray-700 transition-all duration-300">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {isFirestoreError 
                ? `A database error occurred during a ${firestoreInfo.operationType} operation.`
                : "We encountered an unexpected error while running the application."}
            </p>

            <div className="text-left bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl mb-8 overflow-hidden">
              <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Error Details</p>
              <div className="font-mono text-sm text-red-600 dark:text-red-400 break-words overflow-auto max-h-40">
                {isFirestoreError ? (
                  <div className="space-y-2">
                    <p><span className="text-gray-500">Error:</span> {firestoreInfo.error}</p>
                    <p><span className="text-gray-500">Operation:</span> {firestoreInfo.operationType}</p>
                    {firestoreInfo.path && <p><span className="text-gray-500">Path:</span> {firestoreInfo.path}</p>}
                    <p><span className="text-gray-500">User ID:</span> {firestoreInfo.authInfo?.userId || 'Not Authenticated'}</p>
                  </div>
                ) : (
                  errorDetails
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
              >
                Reload Application
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-[0.98]"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
