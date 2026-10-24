import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom UI when an error is caught. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render errors in the child tree and shows a fallback UI.
 * Class component required — React error boundaries are not supported as hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div role="alert">
          <h2>出错了</h2>
          <p>{this.state.error?.message ?? '未知错误'}</p>
          <button type="button" onClick={this.handleRetry}>
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
