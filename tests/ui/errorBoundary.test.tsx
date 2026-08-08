// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../src/control/ErrorBoundary'

/** Componente que revienta a pedido. */
function Bomba({ explota }: { explota: boolean }) {
  if (explota) throw new Error('se rompió el render')
  return <p>contenido normal</p>
}

describe('ErrorBoundary de la ventana de control', () => {
  beforeEach(() => {
    // React escribe el error en consola aunque el boundary lo capture.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('deja pasar el contenido cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <Bomba explota={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('contenido normal')).toBeTruthy()
  })

  it('atrapa el error en vez de dejar la pantalla en blanco', () => {
    // Este es el punto: sin boundary, un error de render dejaba al operador
    // sin nada en pantalla y sin forma de recuperarse en plena reunión.
    render(
      <ErrorBoundary>
        <Bomba explota />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Se rompió/)).toBeTruthy()
    // Aparece dos veces a propósito: en el resumen y dentro del stack.
    expect(screen.getAllByText(/se rompió el render/).length).toBeGreaterThan(0)
  })

  it('aclara que la proyección no se vio afectada', () => {
    render(
      <ErrorBoundary>
        <Bomba explota />
      </ErrorBoundary>
    )
    expect(screen.getByText(/La proyección sigue andando/)).toBeTruthy()
  })

  it('nombra la sección que falló cuando se le dice cuál es', () => {
    render(
      <ErrorBoundary scope="la sección Media">
        <Bomba explota />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Se rompió la sección Media/)).toBeTruthy()
  })

  it('cambiar de sección lo resetea solo', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/media">
        <Bomba explota />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Se rompió/)).toBeTruthy()

    // Al navegar a otra sección, la app tiene que volver a la vida sin que
    // haya que reiniciarla.
    rerender(
      <ErrorBoundary resetKey="/songs">
        <Bomba explota={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('contenido normal')).toBeTruthy()
  })

  it('el botón Reintentar vuelve a renderizar', () => {
    // `estado` es un objeto mutable en vez de una prop para poder dejar de
    // fallar entre renders sin que cambie ninguna prop del boundary: así se
    // prueba el reintento en sí y no el reseteo por resetKey.
    const estado = { falla: true }
    function Intermitente() {
      if (estado.falla) throw new Error('boom')
      return <p>ya anda</p>
    }
    render(
      <ErrorBoundary>
        <Intermitente />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Se rompió/)).toBeTruthy()

    estado.falla = false
    fireEvent.click(screen.getByText('Reintentar'))
    expect(screen.getByText('ya anda')).toBeTruthy()
  })

  it('ofrece el detalle técnico para poder pasarlo', () => {
    render(
      <ErrorBoundary>
        <Bomba explota />
      </ErrorBoundary>
    )
    expect(screen.getByText('Ver detalle técnico')).toBeTruthy()
    expect(screen.getByText('Copiar')).toBeTruthy()
  })
})
