import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// Catches uncaught render/lifecycle errors anywhere in the tree below it —
// without this, one broken component takes down the entire page (blank
// screen in production, Next's dev overlay locally) instead of a scoped
// fallback the user can recover from.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Uncaught render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-base flex items-center justify-center p-6">
          <div className="bg-white border border-border rounded-card shadow-card p-8 max-w-md text-center">
            <AlertTriangle size={28} className="text-danger mx-auto mb-3" />
            <p className="font-display font-semibold text-lg mb-1">Something went wrong</p>
            <p className="text-sm text-ink/50 mb-5">
              This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, let us know.
            </p>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
