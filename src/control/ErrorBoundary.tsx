import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  /**
   * Cambiar este valor resetea el error. Se usa con la ruta actual: si una
   * página revienta, moverse a otra tiene que devolver la app a la vida sin
   * reiniciarla.
   */
  resetKey?: string
  /** Qué se rompió, para el mensaje. */
  scope?: string
}

interface State {
  hasError: boolean
  message: string
  stack: string
}

/**
 * Red de contención de la ventana de control.
 *
 * La ventana de proyección ya tenía la suya; esta no, y sin ella un error de
 * render en cualquier página dejaba al operador con la pantalla en blanco y sin
 * nada que tocar — en vivo, en medio de la reunión, con la única salida de
 * cerrar y abrir la app. Acá al menos queda un cartel, el detalle para poder
 * pasarlo, y un botón para volver.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', stack: '' }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || String(error),
      stack: error.stack ?? ''
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error en la ventana de control:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    // Al cambiar de sección se reintenta: lo más probable es que la sección
    // nueva funcione perfecto y no tiene sentido dejar la app inutilizable.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '', stack: '' })
    }
  }

  private reintentar = (): void => {
    this.setState({ hasError: false, message: '', stack: '' })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex h-full items-center justify-center overflow-y-auto bg-slate-900 p-8">
        <div className="w-full max-w-lg rounded-lg border border-falla-borde bg-falla-suave p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-falla">
            <AlertTriangle className="h-5 w-5" />
            Se rompió {this.props.scope ?? 'esta sección'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            La proyección sigue andando: esto sólo afecta a esta pantalla. Podés
            cambiar de sección desde el menú de arriba, o reintentar acá.
          </p>

          <p className="mt-3 rounded bg-slate-950/70 p-2 font-mono text-xs text-falla">
            {this.state.message}
          </p>

          {this.state.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                Ver detalle técnico
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-950/70 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
                {this.state.stack}
              </pre>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(this.state.stack)}
                className="mt-1 text-xs text-slate-500 hover:text-slate-300"
              >
                Copiar
              </button>
            </details>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.reintentar}
              className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-3 py-2 text-sm text-slate-100 transition-colors hover:bg-slate-600"
            >
              <RotateCcw className="h-4 w-4" />
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              Recargar la ventana
            </button>
          </div>
        </div>
      </div>
    )
  }
}
