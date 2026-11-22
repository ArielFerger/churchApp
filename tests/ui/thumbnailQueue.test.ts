// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { requestThumbnail } from '@/control/media/thumbnailQueue'
import { readThumbnail } from '@/control/media/thumbnailCache'

vi.mock('@/control/media/thumbnailCache', () => ({
  readThumbnail: vi.fn(),
  saveThumbnail: vi.fn()
}))

describe('cola de miniaturas', () => {
  it('comparte la solicitud de dos vistas y descarta las que dejaron de ser visibles', async () => {
    const preview = { src: 'data:image/webp;base64,prueba', duration: 12 }
    let finish!: (value: typeof preview) => void
    const read = vi.mocked(readThumbnail).mockReset()
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    read.mockResolvedValue(preview)

    const first = vi.fn()
    const duplicate = vi.fn()
    const obsolete = vi.fn()
    const next = vi.fn()
    const leave = requestThumbnail('uno', 'v1', 'video', first)
    requestThumbnail('uno', 'v1', 'video', duplicate)
    const cancel = requestThumbnail('dos', 'v1', 'image', obsolete)
    requestThumbnail('tres', 'v1', 'video', next)
    leave()
    cancel()
    expect(read.mock.calls).toEqual([['uno/v1']])
    finish(preview)
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(preview))
    expect(duplicate).toHaveBeenCalledWith(preview)
    expect(first).not.toHaveBeenCalled()
    expect(obsolete).not.toHaveBeenCalled()
    expect(read.mock.calls).toEqual([['uno/v1'], ['tres/v1']])

    requestThumbnail('uno', 'v1', 'video', first)
    expect(first).toHaveBeenCalledWith(preview)
    expect(read).toHaveBeenCalledTimes(2)
    requestThumbnail('uno', 'v2', 'video', first)
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(2))
    expect(read).toHaveBeenLastCalledWith('uno/v2')
  })

  it('un archivo dañado no deja bloqueado el siguiente', async () => {
    const read = vi.mocked(readThumbnail).mockReset()
    read.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ src: 'poster' })
    const create = vi.spyOn(document, 'createElement')
    try {
      const failed = vi.fn()
      const next = vi.fn()
      requestThumbnail('roto', 'v1', 'video', failed)
      requestThumbnail('siguiente', 'v1', 'video', next)
      await vi.waitFor(() => expect(create).toHaveBeenCalledWith('video'))
      const video = create.mock.results.find((_, i) => create.mock.calls[i][0] === 'video')!.value
      video.dispatchEvent(new Event('error'))
      await vi.waitFor(() => expect(next).toHaveBeenCalledWith({ src: 'poster' }))
      expect(failed).toHaveBeenCalledWith(null)
    } finally {
      create.mockRestore()
    }
  })
})
