import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this changes (e.g. the route), a caught error is cleared and children render again. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches render errors below it so one broken component shows a recoverable panel
 * instead of blanking the page. Errors go to the console only: the app sends nothing
 * anywhere. Render-phase errors only, as React allows; event handlers and async code
 * report their own failures.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    // Navigating away from the page that crashed is a fresh start.
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="max-w-xl mx-auto my-12 p-8 bg-white rounded-xl border border-dashed border-red-300 text-center space-y-3">
        <h2 className="text-lg font-bold text-red-700">Something went wrong</h2>
        <p className="text-sm text-slate-600">
          This part of the page hit an unexpected error. Your saved stories, AI results and settings are untouched.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={this.reset}
            className="px-3.5 py-1.5 max-md:min-h-10 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3.5 py-1.5 max-md:min-h-10 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Reload page
          </button>
          {/* A plain link, so it works even when the router itself is what failed. */}
          <a
            href={import.meta.env.BASE_URL}
            className="inline-flex items-center px-3.5 py-1.5 max-md:min-h-10 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-semibold text-xs rounded-lg"
          >
            Go to start page
          </a>
        </div>
        <details className="text-left text-xs text-slate-500 pt-2">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 p-3 bg-slate-50 rounded-lg overflow-x-auto whitespace-pre-wrap">{error.message}</pre>
        </details>
      </div>
    );
  }
}
