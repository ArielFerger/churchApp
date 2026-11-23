import type { MediaType } from '@/shared/types/media'
import { readThumbnail, saveThumbnail, type Thumbnail } from './thumbnailCache'

type Listener = (result: Thumbnail | null) => void
interface Job {
  key: string
  url: string
  type: MediaType
  listeners: Set<Listener>
  controller: AbortController
}

// Sólo hay un original abierto para generar miniaturas en toda la cabina.
const jobs = new Map<string, Job>()
const recent = new Map<string, Thumbnail>()
let running = false

export function requestThumbnail(
  id: string,
  revision: string,
  type: MediaType,
  listener: Listener
) {
  const key = `${id}/${revision}`
  const cached = recent.get(key)
  if (cached) {
    recent.delete(key)
    recent.set(key, cached)
    listener(cached)
    return () => {}
  }

  let job = jobs.get(key)
  if (!job) {
    job = {
      key,
      type,
      url: `media://${id}?v=${revision}`,
      listeners: new Set(),
      controller: new AbortController()
    }
    jobs.set(key, job)
  }
  job.listeners.add(listener)
  void drain()
  return () => {
    job.listeners.delete(listener)
    if (!job.listeners.size && jobs.get(key) === job) {
      jobs.delete(key)
      job.controller.abort()
    }
  }
}

async function drain(): Promise<void> {
  if (running) return
  running = true
  try {
    for (const job of jobs.values()) {
      const signal = job.controller.signal
      let result = await readThumbnail(job.key).catch(() => undefined)
      if (signal.aborted) continue
      if (!result) {
        result = await capture(job.url, job.type, signal).catch(() => undefined)
        if (signal.aborted) continue
        if (result) void saveThumbnail(job.key, result).catch(() => {})
      }
      jobs.delete(job.key)
      if (result) {
        recent.set(job.key, result)
        if (recent.size > 64) recent.delete(recent.keys().next().value!)
      }
      for (const listener of job.listeners) listener(result ?? null)
    }
  } finally {
    running = false
  }
}

function capture(url: string, type: MediaType, signal: AbortSignal): Promise<Thumbnail> {
  return new Promise((resolve, reject) => {
    const source = type === 'video' ? document.createElement('video') : new Image()
    const video = source instanceof HTMLVideoElement ? source : null
    const timeout = window.setTimeout(fail, 10000)
    const ready = video ? 'loadeddata' : 'load'
    function cleanup() {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', fail)
      source.removeEventListener('error', fail)
      source.removeEventListener(ready, draw)
      source.removeAttribute('src')
      video?.load()
    }
    function fail() {
      cleanup()
      reject(new Error('Miniatura no disponible'))
    }
    function draw() {
      try {
        const width = video ? video.videoWidth : (source as HTMLImageElement).naturalWidth
        const height = video ? video.videoHeight : (source as HTMLImageElement).naturalHeight
        if (!width || !height) throw new Error('Fotograma vacío')
        const scale = Math.min(1, 384 / width, 256 / height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas no disponible')
        context.drawImage(source, 0, 0, canvas.width, canvas.height)
        resolve({
          src: canvas.toDataURL('image/webp', 0.85),
          duration: video && Number.isFinite(video.duration) ? video.duration : undefined
        })
      } catch (error) {
        reject(error)
      } finally {
        cleanup()
      }
    }
    signal.addEventListener('abort', fail, { once: true })
    source.addEventListener('error', fail, { once: true })
    source.addEventListener(ready, draw, { once: true })
    source.crossOrigin = 'anonymous'
    if (video) {
      video.muted = true
      video.preload = 'auto'
    }
    source.src = url
  })
}
