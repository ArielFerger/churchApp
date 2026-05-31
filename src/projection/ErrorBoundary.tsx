import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Keeps the projection output safe: if anything in the tree throws while
 * rendering, we fall back to a plain black screen instead of a blank/white
 * (or GPU-default blue) surface. The operator can recover via the control
 * window's "Mostrar proyección" button (double-click reloads).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaces in the projection window devtools; harmless in production.
    console.error('Projection render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <div className="h-screen w-screen bg-black" />
    }
    return this.props.children
  }
}
