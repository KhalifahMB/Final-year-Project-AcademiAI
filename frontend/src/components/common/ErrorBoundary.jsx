import { Component } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Simple ErrorBoundary that catches render errors in its subtree and shows
 * a friendly recovery screen instead of white-screening the whole app.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI error:', error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An unexpected error occurred while rendering this page. Try reloading.
            </p>
            {this.props.showDetails !== false && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-muted p-2 text-left text-[11px] text-muted-foreground">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
            <Button onClick={this.handleReset} className="mt-4" size="sm">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
