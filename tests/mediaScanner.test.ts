import { EventEmitter } from 'node:events'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import chokidar from 'chokidar'
import { MediaScanner } from '@electron/services/mediaScanner'

vi.mock('chokidar', () => ({ default: { watch: vi.fn() } }))
vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn() } }))

describe('índice multimedia', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('agrupa cambios, reutiliza la lista ordenada y descarta eventos de la carpeta anterior', async () => {
    const watch = () =>
      Object.assign(new EventEmitter(), { close: vi.fn().mockResolvedValue(undefined) })
    const old = watch()
    const current = watch()
    vi.mocked(chokidar.watch)
      .mockReturnValueOnce(old as unknown as ReturnType<typeof chokidar.watch>)
      .mockReturnValueOnce(current as unknown as ReturnType<typeof chokidar.watch>)
    const scanner = new MediaScanner()
    const notify = vi.fn()
    scanner.onChange(notify)
    await scanner.setFolder('/uno')
    const stats = { mtime: new Date(), size: 100 }
    for (let i = 100; i > 0; i--) old.emit('add', `/uno/${i}.mp4`, stats)
    vi.advanceTimersByTime(250)
    const list = scanner.list()
    expect(list).toHaveLength(100)
    expect(list[1].fileName).toBe('2.mp4')
    expect(list).toBe(scanner.list())
    expect(notify).toHaveBeenCalledTimes(2) // vaciado inicial + lote
    old.emit('unlink', '/uno/2.mp4')
    old.emit('change', '/uno/1.mp4', { ...stats, size: 23 })
    expect(scanner.list()).toHaveLength(99)
    expect(scanner.list()[0].byteSize).toBe(23)

    await scanner.setFolder('/dos')
    old.emit('add', '/uno/viejo.mp4', stats)
    current.emit('add', '/dos/nuevo.mp4', stats)
    vi.advanceTimersByTime(250)
    expect(scanner.list().map((item) => item.fileName)).toEqual(['nuevo.mp4'])
    await scanner.dispose()
    expect(current.close).toHaveBeenCalledTimes(1)
  })
})
