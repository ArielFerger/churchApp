// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import BarraAlAire from '../../src/control/components/BarraAlAire'
import { useLiveStore } from '../../src/shared/store/liveStore'
import { useLibraryStore } from '../../src/shared/store/libraryStore'
import { useLiveControlsStore } from '../../src/shared/store/liveControlsStore'
import type { MediaItem } from '../../src/shared/types/media'

/**
 * La barra AL AIRE tiene que decir la verdad sobre lo que ve la congregación.
 * Un fondo en loop sin nada encima TAMBIÉN está al aire: antes la barra decía
 * "SIN SEÑAL — la pantalla está vacía" con un video sonando en el proyector.
 */

const loop = { id: 'm1', type: 'video', fileName: 'loop-vida.mp4' } as MediaItem

beforeEach(() => {
  useLiveStore.setState({ lastCommand: null, isBlackout: false, isLive: false })
  useLibraryStore.setState({ media: [loop], liveMedia: [] })
  useLiveControlsStore.setState({ backgroundId: null, slideshowActive: false, slideshowIds: [] })
})

afterEach(cleanup)

describe('BarraAlAire', () => {
  it('sin nada, dice que la pantalla está vacía', () => {
    render(<BarraAlAire />)
    expect(screen.getByText('SIN SEÑAL')).toBeTruthy()
  })

  it('con sólo un fondo puesto, está al aire y dice cuál', () => {
    useLiveControlsStore.setState({ backgroundId: 'm1' })
    render(<BarraAlAire />)
    expect(screen.getByText('AL AIRE')).toBeTruthy()
    expect(screen.getByText('FONDO')).toBeTruthy()
    expect(screen.getByText('loop-vida.mp4')).toBeTruthy()
  })

  it('con contenido encima del fondo, el fondo se menciona aparte', () => {
    useLiveControlsStore.setState({ backgroundId: 'm1' })
    render(<BarraAlAire />)
    act(() => {
      useLiveStore.getState().apply({
        type: 'showBibleVerse',
        reference: 'Juan 3:16',
        text: '…',
        version: 'RVR1909'
      })
    })
    expect(screen.getByText(/\+ fondo: loop-vida\.mp4/)).toBeTruthy()
  })

  it('una presentación corriendo cuenta como fondo', () => {
    useLiveControlsStore.setState({ slideshowActive: true, slideshowIds: ['a', 'b', 'c'] })
    render(<BarraAlAire />)
    expect(screen.getByText('Presentación de 3 imágenes')).toBeTruthy()
  })

  it('con blackout el fondo no se ve, y no se lo nombra', async () => {
    useLiveControlsStore.setState({ backgroundId: 'm1' })
    render(<BarraAlAire />)
    act(() => useLiveStore.getState().apply({ type: 'blackout' }))
    // El texto viejo sale con un fundido: se espera a que termine.
    await waitFor(() => expect(screen.queryByText(/loop-vida/)).toBeNull())
    expect(screen.getByText('AL AIRE')).toBeTruthy()
  })
})
