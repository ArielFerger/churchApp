import type { BibleFont } from '../types/fonts'

/**
 * Sincroniza las FontFace del documento con la lista de fuentes subidas.
 * Sirve igual en la ventana de control (vista previa) y en la de proyección.
 * Las fuentes se sirven vía appfont://<id> (protocolo registrado en main).
 */

const registered = new Map<string, FontFace>()

export function syncFontFaces(fonts: BibleFont[]): void {
  // Quitar las que ya no existen.
  for (const [id, face] of registered) {
    if (!fonts.some((f) => f.id === id)) {
      document.fonts.delete(face)
      registered.delete(id)
    }
  }
  // Registrar las nuevas.
  for (const font of fonts) {
    if (registered.has(font.id)) continue
    try {
      const face = new FontFace(font.family, `url("appfont://${font.id}")`)
      registered.set(font.id, face)
      document.fonts.add(face)
      face.load().catch(() => {
        // Archivo corrupto o formato no soportado: la familia cae al fallback.
      })
    } catch {
      // Nombre de familia inválido — ignorar esa fuente.
    }
  }
}
