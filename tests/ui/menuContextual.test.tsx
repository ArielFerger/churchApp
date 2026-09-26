// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  ProveedorMenuContextual,
  useMenuContextual,
  type EntradaMenu
} from '../../src/control/components/ui/MenuContextual'

/**
 * El menú de clic derecho: que se abra donde corresponde, que se maneje con
 * teclado (flechas, Enter, submenús) y que lo deshabilitado no haga nada.
 */

afterEach(cleanup)

function Prueba({ entradas }: { entradas: EntradaMenu[] }) {
  const abrir = useMenuContextual()
  return (
    <button type="button" onContextMenu={(e) => abrir(e, entradas)}>
      objetivo
    </button>
  )
}

function montar(entradas: EntradaMenu[]) {
  render(
    <MemoryRouter>
      <ProveedorMenuContextual>
        <Prueba entradas={entradas} />
      </ProveedorMenuContextual>
    </MemoryRouter>
  )
  fireEvent.contextMenu(screen.getByText('objetivo'), { clientX: 40, clientY: 40 })
}

describe('MenuContextual', () => {
  it('se abre con clic derecho y ejecuta la opción elegida', async () => {
    const proyectar = vi.fn()
    montar([{ titulo: 'video.mp4' }, { etiqueta: 'Mostrar en proyección', onSelect: proyectar }])
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByText('video.mp4')).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: /Mostrar en proyección/ }))
    expect(proyectar).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('las opciones vacías (false/null) no se dibujan', () => {
    montar([{ etiqueta: 'Una' }, false, null, 'separador', { etiqueta: 'Dos' }])
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  it('se maneja con flechas y Enter', async () => {
    const segunda = vi.fn()
    montar([{ etiqueta: 'Primera' }, { etiqueta: 'Segunda', onSelect: segunda }])
    const menu = screen.getByRole('menu')
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Primera'))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('Segunda')
    ;(document.activeElement as HTMLButtonElement).click()
    expect(segunda).toHaveBeenCalled()
  })

  it('una opción deshabilitada no hace nada', () => {
    const nada = vi.fn()
    montar([{ etiqueta: 'Playlists', deshabilitado: true, onSelect: nada }])
    fireEvent.click(screen.getByRole('menuitem', { name: /Playlists/ }))
    expect(nada).not.toHaveBeenCalled()
  })

  it('abre un submenú y marca la opción vigente', async () => {
    const mover = vi.fn()
    montar([
      {
        etiqueta: 'Categoría',
        submenu: [
          { etiqueta: 'Alabanza', marcado: true },
          { etiqueta: 'Adoración', marcado: false, onSelect: mover }
        ]
      }
    ])
    fireEvent.click(screen.getByRole('menuitem', { name: /Categoría/ }))
    const alabanza = await screen.findByRole('menuitemcheckbox', { name: /Alabanza/ })
    expect(alabanza.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Adoración/ }))
    expect(mover).toHaveBeenCalled()
  })
})
