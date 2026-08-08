// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AudioTrack } from '../../src/shared/types/audio'

/**
 * Doble de Howl: registra las llamadas para poder afirmar que el fade-out
 * NO frena al tema equivocado.
 */
class HowlDoble {
  static instancias: HowlDoble[] = []
  stop = vi.fn()
  unload = vi.fn()
  play = vi.fn()
  pause = vi.fn()
  fade = vi.fn()
  seek = vi.fn(() => 0)
  loop = vi.fn(() => false)
  private vol = 1
  private sonando = false

  constructor(opts: { onload?: () => void; onplay?: () => void }) {
    HowlDoble.instancias.push(this)
    this.play.mockImplementation(() => {
      this.sonando = true
      opts.onplay?.()
    })
    this.stop.mockImplementation(() => {
      this.sonando = false
    })
    // La carga se resuelve al instante para no depender de temporizadores.
    opts.onload?.()
  }

  playing(): boolean {
    return this.sonando
  }

  volume(v?: number): number {
    if (v !== undefined) this.vol = v
    return this.vol
  }

  duration(): number {
    return 180
  }
}

vi.mock('howler', () => ({ Howl: vi.fn((opts) => new HowlDoble(opts)) }))

const { AudioEngine } = await import('../../src/control/audio/audioEngine')

const track = (id: string): AudioTrack => ({
  id,
  filePath: `D:/musica/${id}.mp3`,
  title: id,
  duration: 180,
  addedAt: ''
})

describe('AudioEngine: fade-out', () => {
  let engine: InstanceType<typeof AudioEngine>

  beforeEach(() => {
    vi.useFakeTimers()
    HowlDoble.instancias = []
    engine = new AudioEngine()
  })

  afterEach(() => {
    engine.dispose()
    vi.useRealTimers()
  })

  it('el fade-out frena el tema al terminar', async () => {
    await engine.play(track('uno'))
    const uno = HowlDoble.instancias[0]

    engine.stopWithFade()
    expect(uno.fade).toHaveBeenCalled()
    expect(uno.stop).not.toHaveBeenCalled() // todavía se está apagando

    vi.advanceTimersByTime(2000)
    expect(uno.stop).toHaveBeenCalled()
  })

  it('NO frena el tema nuevo si se arranca otro durante el fade', async () => {
    // El bug: el timeout del fade leía `this.howl`, que para cuando disparaba
    // ya era el tema nuevo. Resultado: ponías una canción y se cortaba sola
    // un segundo después.
    await engine.play(track('viejo'))
    engine.stopWithFade()

    await engine.play(track('nuevo'))
    const nuevo = HowlDoble.instancias[1]
    nuevo.stop.mockClear()

    vi.advanceTimersByTime(5000)
    expect(nuevo.stop).not.toHaveBeenCalled()
    expect(nuevo.playing()).toBe(true)
  })

  it('NO frena el mismo tema si se lo reanuda durante el fade', async () => {
    await engine.play(track('uno'))
    const uno = HowlDoble.instancias[0]

    engine.stopWithFade()
    await engine.play(track('uno')) // el operador se arrepiente
    uno.stop.mockClear()

    vi.advanceTimersByTime(5000)
    expect(uno.stop).not.toHaveBeenCalled()
    expect(engine.snapshot().isFadingOut).toBe(false)
  })

  it('reanudar durante el fade devuelve el volumen a su valor', async () => {
    await engine.play(track('uno'))
    const uno = HowlDoble.instancias[0]
    engine.setVolume(0.5)

    engine.stopWithFade()
    await engine.play(track('uno'))
    // Sin restaurarlo, el tema seguía sonando con el volumen que dejó el fade.
    expect(uno.volume()).toBeCloseTo(0.5)
  })

  it('dispose cancela un fade pendiente', async () => {
    await engine.play(track('uno'))
    const uno = HowlDoble.instancias[0]
    engine.stopWithFade()
    engine.dispose()
    uno.stop.mockClear()

    vi.advanceTimersByTime(5000)
    expect(uno.stop).not.toHaveBeenCalled()
  })
})
