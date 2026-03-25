import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class BootstrapErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SIBOT renderer crash", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-shell">
          <div className="fatal-shell__card">
            <p className="brand-block__eyebrow">RENDERER ERROR</p>
            <h1>화면을 그리는 중 오류가 발생했습니다.</h1>
            <p className="field__description">
              앱은 실행됐지만 UI 렌더링에서 오류가 났습니다. 새로고침 후 다시 확인하세요.
            </p>
            <pre className="json-panel">{this.state.error.message}</pre>
            <div className="button-row">
              <button className="button button--primary" onClick={() => window.location.reload()} type="button">
                화면 다시 불러오기
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
