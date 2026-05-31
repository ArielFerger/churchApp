import { create } from 'zustand'

const DEFAULT_TEST_TEXT = 'Bienvenidos\na la prueba de proyección'

interface LiveControlsState {
  /** Editable test-slide text (persists across tab switches). */
  testSlideText: string
  setTestSlideText: (t: string) => void
  resetTestSlideText: () => void

  /** Single background currently selected (for UI highlight). */
  backgroundId: string | null
  setBackgroundId: (id: string | null) => void

  /** Background slideshow builder state. */
  slideshowIds: string[]
  slideshowIntervalSec: number
  slideshowActive: boolean
  toggleSlideshowItem: (id: string) => void
  clearSlideshow: () => void
  setSlideshowInterval: (sec: number) => void
  setSlideshowActive: (active: boolean) => void
}

export const useLiveControlsStore = create<LiveControlsState>((set) => ({
  testSlideText: DEFAULT_TEST_TEXT,
  setTestSlideText: (t) => set({ testSlideText: t }),
  resetTestSlideText: () => set({ testSlideText: DEFAULT_TEST_TEXT }),

  backgroundId: null,
  setBackgroundId: (id) => set({ backgroundId: id }),

  slideshowIds: [],
  slideshowIntervalSec: 8,
  slideshowActive: false,
  toggleSlideshowItem: (id) =>
    set((s) => ({
      slideshowIds: s.slideshowIds.includes(id)
        ? s.slideshowIds.filter((x) => x !== id)
        : [...s.slideshowIds, id]
    })),
  clearSlideshow: () => set({ slideshowIds: [], slideshowActive: false }),
  setSlideshowInterval: (sec) => set({ slideshowIntervalSec: sec }),
  setSlideshowActive: (active) => set({ slideshowActive: active })
}))

export { DEFAULT_TEST_TEXT }
