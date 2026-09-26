import { create } from 'zustand'
import { ACTIVOS, type DownloadJob } from '../utils/downloads'

/**
 * La cola de descargas, espejada del proceso principal.
 *
 * Antes la lista vivía adentro de la página Descargar: mientras el operador
 * estaba en otra sección, nadie escuchaba los cambios, y no había forma de
 * avisar "terminó de bajar el video" ni de mostrar cuántas van en curso desde
 * la navegación. Ahora la suscripción se hace una vez, en App.
 */
interface DownloadsState {
  jobs: DownloadJob[]
  install: { step: string; ratio: number | null } | null
  setJobs: (jobs: DownloadJob[]) => void
  setInstall: (install: { step: string; ratio: number | null } | null) => void
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  jobs: [],
  install: null,
  setJobs: (jobs) => set({ jobs }),
  setInstall: (install) => set({ install })
}))

/** Cuántas descargas siguen en curso (en cola, preparando, bajando o procesando). */
export function descargasActivas(jobs: DownloadJob[]): number {
  return jobs.filter((j) => ACTIVOS.includes(j.stage)).length
}
