import { create } from 'zustand'

interface VideoQueueState {
  /** Ids de los videos en cola, en orden de reproducción. */
  ids: string[]
  /** Id del video de la cola que está sonando ahora (null = cola detenida). */
  currentId: string | null
  /** True mientras la cola está reproduciéndose (avanza sola al terminar cada video). */
  active: boolean

  add: (id: string) => void
  /** Lo pone justo después del que está sonando (o primero, si no suena nada). */
  addNext: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  move: (id: string, dir: -1 | 1) => void
  setCurrent: (id: string | null) => void
  setActive: (active: boolean) => void
  /** Id que sigue al actual (null si el actual es el último o no hay actual). */
  nextAfter: (id: string) => string | null
}

export const useVideoQueueStore = create<VideoQueueState>((set, get) => ({
  ids: [],
  currentId: null,
  active: false,

  add: (id) =>
    set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),

  addNext: (id) =>
    set((s) => {
      const sinEl = s.ids.filter((x) => x !== id)
      const i = s.currentId ? sinEl.indexOf(s.currentId) : -1
      const ids = [...sinEl]
      ids.splice(i + 1, 0, id)
      return { ids }
    }),

  remove: (id) =>
    set((s) => ({
      ids: s.ids.filter((x) => x !== id),
      // Si se quita el que está sonando, la cola sigue viva pero sin actual;
      // el avance automático ya no aplicará a ese video.
      currentId: s.currentId === id ? null : s.currentId
    })),

  clear: () => set({ ids: [], currentId: null, active: false }),

  move: (id, dir) =>
    set((s) => {
      const i = s.ids.indexOf(id)
      const j = i + dir
      if (i === -1 || j < 0 || j >= s.ids.length) return s
      const ids = [...s.ids]
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
      return { ids }
    }),

  setCurrent: (id) => set({ currentId: id }),
  setActive: (active) => set({ active }),

  nextAfter: (id) => {
    const { ids } = get()
    const i = ids.indexOf(id)
    if (i === -1 || i + 1 >= ids.length) return null
    return ids[i + 1]
  }
}))
