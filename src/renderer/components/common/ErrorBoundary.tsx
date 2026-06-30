import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="h-screen flex items-center justify-center bg-red-50 dark:bg-red-950/20 p-8">
            <div className="max-w-lg w-full bg-card rounded-xl border border-red-200 dark:border-red-800 shadow-lg p-6 space-y-4 font-mono text-sm">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <span className="text-lg">&#x26A0;</span>
                <span className="font-bold">Render Error</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-red-700 dark:text-red-300 text-xs whitespace-pre-wrap break-all">
                {this.state.error?.message ?? 'Unknown error'}
              </div>
              {this.state.error?.stack && (
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Stack trace
                  </summary>
                  <pre className="mt-2 text-[10px] text-muted-foreground/60 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
