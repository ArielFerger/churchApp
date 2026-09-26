// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Escucha from '../../src/control/pages/Escucha'
import { useEscuchaStore } from '../../src/shared/store/escuchaStore'
import type { ProjectionCommand } from '../../src/shared/types/ipc'

/**
 * Lo que se prueba acá es la promesa del módulo: **la app sugiere, el operador
 * proyecta**. Que la sugerencia aparezca sola es la función; que salga a la
 * pantalla sola sería el peor defecto posible.
 *
 * El micrófono se mockea entero: happy-dom no tiene `getUserMedia` ni
 * `AudioContext`, y no hace falta audio para probar la pantalla.
 */

vi.mock('../../src/control/audio/capturaVoz', () => ({
  entradasDeAudio: async () => [
    { deviceId: 'consola', label: 'Line In (consola)', kind: 'audioinput' }
  ]
}))

const iniciarEscucha = vi.fn(async (_o?: { deviceId?: string | null; sensibilidad?: number }) => {})
const detenerEscucha = vi.fn(async () => {})
vi.mock('../../src/control/audio/escuchaEnVivo', () => ({
  iniciarEscucha: (o?: { deviceId?: string | null; sensibilidad?: number }) => iniciarEscucha(o),
  detenerEscucha: () => detenerEscucha(),
  cambiarSensibilidad: () => {}
}))

let enviados: ProjectionCommand[] = []
let versiculoExiste = true

const NOMBRES: Record<string, string> = {
  JHN: 'Juan',
  '1CO': '1 Corintios',
  PSA: 'Salmos',
  ROM: 'Romanos'
}

const RESULTADO = {
  version: { version: 'RVR1909', name: 'Reina Valera', language: 'es', bookCount: 66 },
  bookId: 'JHN',
  bookName: 'Juan',
  chapter: 3,
  verse: 16,
  text: 'Porque de tal manera amó Dios al mundo…',
  verses: []
}

beforeEach(() => {
  enviados = []
  versiculoExiste = true
  iniciarEscucha.mockClear()
  useEscuchaStore.getState().limpiar()

  window.electronAPI = {
    getEscuchaStatus: async () => ({
      binPath: 'C:/tools/whisper-cli.exe',
      serverPath: 'C:/tools/whisper-server.exe',
      modelo: 'base',
      modelPath: 'C:/tools/ggml-base.bin',
      instalados: ['base'],
      searched: [],
      instalable: true,
      falta: null,
      descartadas: 0,
      motor: 'servidor',
      servidor: 'apagado',
      errorServidor: null
    }),
    onEscuchaProgress: () => () => {},
    onEscuchaStatus: () => () => {},
    getBibleBookStats: async () => ({}),
    getBibleVersions: async () => [RESULTADO.version],
    // Devuelve lo que le piden, como haría la Biblia de verdad: si el mock
    // contestara siempre el mismo libro, un error de la pantalla al armar la
    // referencia pasaría desapercibido.
    lookupVerse: async (req: { bookId: string; chapter: number; verse: number }) =>
      versiculoExiste
        ? {
            ...RESULTADO,
            bookId: req.bookId,
            bookName: NOMBRES[req.bookId] ?? req.bookId,
            chapter: req.chapter,
            verse: req.verse
          }
        : null,
    sendProjectionCommand: (cmd: ProjectionCommand) => enviados.push(cmd)
  } as unknown as typeof window.electronAPI
})

afterEach(cleanup)

/** Mete una cita en el store como si la hubiera oído whisper. */
function oyó(texto: string): void {
  useEscuchaStore.getState().aplicarVentana(texto, 1200)
}

describe('sección Escucha', () => {
  it('muestra la cita que se nombró, sin proyectar nada', async () => {
    oyó('abramos en juan capítulo tres versículo dieciséis')
    render(<Escucha />)

    expect(await screen.findByText('Juan 3:16')).toBeTruthy()
    // Lo importante de este test: apareció la sugerencia y NO salió al aire.
    expect(enviados).toHaveLength(0)
  })

  it('proyecta recién cuando el operador aprieta Proyectar', async () => {
    oyó('abramos en juan capítulo tres versículo dieciséis')
    render(<Escucha />)
    await screen.findByText('Juan 3:16')

    fireEvent.click(screen.getByRole('button', { name: /Proyectar/ }))

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({
      type: 'showBibleVerse',
      reference: 'Juan 3:16',
      version: 'RVR1909'
    })
    expect(await screen.findByText(/ya salió/)).toBeTruthy()
  })

  it('un capítulo sin versículo sale desde el primero', async () => {
    oyó('vamos a primera de corintios trece')
    render(<Escucha />)
    await screen.findByText('1 Corintios 13')

    fireEvent.click(screen.getByRole('button', { name: /Proyectar/ }))
    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({ reference: '1 Corintios 13:1' })
  })

  it('avisa en vez de proyectar cuando el versículo no existe', async () => {
    // Whisper puede oír mal el número. Antes que sacar cualquier cosa a la
    // pantalla, se avisa y se ofrece corregirlo.
    versiculoExiste = false
    oyó('abramos en juan capítulo tres versículo dieciséis')
    render(<Escucha />)
    await screen.findByText('Juan 3:16')

    fireEvent.click(screen.getByRole('button', { name: /Proyectar/ }))

    expect(await screen.findByText(/no existe en RVR1909/)).toBeTruthy()
    expect(enviados).toHaveLength(0)
  })

  it('deja corregir el número antes de mandarlo a la pantalla', async () => {
    oyó('abramos en juan capítulo tres versículo dieciséis')
    render(<Escucha />)
    await screen.findByText('Juan 3:16')

    fireEvent.click(screen.getByRole('button', { name: /Corregir/ }))
    fireEvent.change(screen.getByLabelText('Versículo'), { target: { value: '17' } })
    expect(screen.getByText('Juan 3:17')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Proyectar/ }))
    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({ reference: 'Juan 3:17' })
  })

  it('se puede descartar una sugerencia que no servía', async () => {
    oyó('abramos en juan capítulo tres versículo dieciséis')
    render(<Escucha />)
    await screen.findByText('Juan 3:16')

    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }))
    await waitFor(() => expect(screen.queryByText('Juan 3:16')).toBeNull())
    expect(enviados).toHaveLength(0)
  })

  it('el botón grande arranca la escucha con la entrada elegida', async () => {
    render(<Escucha />)
    fireEvent.click(await screen.findByRole('button', { name: /Escuchar/ }))
    expect(iniciarEscucha).toHaveBeenCalledTimes(1)
  })

  it('muestra el texto del versículo para confirmarlo antes de proyectar', async () => {
    oyó('abramos en Juan 3:16')
    render(<Escucha />)
    expect(await screen.findByText(/Porque de tal manera amó Dios/)).toBeTruthy()
    expect(enviados).toHaveLength(0)
  })

  it('Ctrl+Enter proyecta la más nueva, y sólo con Ctrl', async () => {
    oyó('abramos en Juan 3:16')
    oyó('y ahora vamos a Romanos 8:28')
    render(<Escucha />)
    await screen.findByRole('listitem', { name: 'Romanos 8:28' })

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(enviados).toHaveLength(0)

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({ reference: 'Romanos 8:28' })
  })

  it('después de proyectar, "Siguiente" avanza un versículo', async () => {
    oyó('abramos en Juan 3:16')
    render(<Escucha />)
    await screen.findByRole('listitem', { name: 'Juan 3:16' })
    fireEvent.click(screen.getByRole('button', { name: /Proyectar/ }))
    await waitFor(() => expect(enviados).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Versículo siguiente' }))
    await waitFor(() => expect(enviados).toHaveLength(2))
    expect(enviados[1]).toMatchObject({ reference: 'Juan 3:17' })
  })
})
