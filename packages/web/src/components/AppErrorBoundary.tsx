import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last-resort shell so a child render/API throw cannot leave a white screen.
 * Games / magazine / consult failures must stay isolated from the marketing homepage.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="pd-app-error" dir="rtl" role="alert">
        <p>مشکلی پیش آمد. صفحه را دوباره بارگذاری کنید.</p>
        <button type="button" className="pepito-btn" onClick={() => window.location.reload()}>
          تلاش دوباره
        </button>
      </div>
    );
  }
}
