// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { useTransientMessage } from '../../src/control/hooks/useTransientMessage'

function Pantalla({ ms }: { ms?: number }) {
  const [mensaje, mostrar] = useTransientMessage(ms)
  return (
    <div>
      <p data-testid="msg">{mensaje ?? '(vacío)'}</p>
      <button onClick={() => mostrar('guardado')}>uno</button>
      <button onClick={() => mostrar('otro')}>dos</button>
      <button onClick={() => mostrar(null)}>limpiar</button>
    </div>
  )
}

const texto = () => screen.getByTestId('msg').textContent

describe('useTransientMessage', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('muestra el mensaje y lo borra solo', () => {
    render(<Pantalla ms={1000} />)
    expect(texto()).toBe('(vacío)')

    act(() => screen.getByText('uno').click())
    expect(texto()).toBe('guardado')

    act(() => void vi.advanceTimersByTime(999))
    expect(texto()).toBe('guardado')

    act(() => void vi.advanceTimersByTime(2))
    expect(texto()).toBe('(vacío)')
  })

  it('un mensaje nuevo reinicia el reloj en vez de acumular timers', () => {
    // Antes cada mensaje dejaba su propio setTimeout suelto: el primero en
    // vencer borraba el mensaje del segundo antes de tiempo.
    render(<Pantalla ms={1000} />)
    act(() => screen.getByText('uno').click())
    act(() => void vi.advanceTimersByTime(900))
    act(() => screen.getByText('dos').click())

    act(() => void vi.advanceTimersByTime(200))
    expect(texto()).toBe('otro') // el timer viejo no se lo llevó puesto

    act(() => void vi.advanceTimersByTime(900))
    expect(texto()).toBe('(vacío)')
  })

  it('se puede limpiar a mano sin dejar el timer colgado', () => {
    render(<Pantalla ms={1000} />)
    act(() => screen.getByText('uno').click())
    act(() => screen.getByText('limpiar').click())
    expect(texto()).toBe('(vacío)')
    act(() => void vi.advanceTimersByTime(5000))
    expect(texto()).toBe('(vacío)')
  })

  it('desmontar cancela el timer pendiente', () => {
    // El punto del hook: sin esto, cambiar de sección con un mensaje en
    // pantalla dejaba una actualización de estado apuntando a un componente
    // ya desmontado, y React lo avisaba por consola.
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<Pantalla ms={1000} />)
    act(() => screen.getByText('uno').click())
    unmount()

    act(() => void vi.advanceTimersByTime(5000))
    expect(aviso).not.toHaveBeenCalled()
    aviso.mockRestore()
  })
})
