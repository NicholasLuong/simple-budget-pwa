import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/button';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Budget Pocket recovered from an application error.', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <h1>Budget Pocket needs to reload</h1>
          <p>Your local budget data is safe. Reload the app to return to the current month.</p>
          <Button className="mt-5 w-full" onClick={() => window.location.reload()}>Reload app</Button>
        </main>
      );
    }
    return this.props.children;
  }
}
