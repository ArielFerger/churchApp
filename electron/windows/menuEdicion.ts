import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

/**
 * Clic derecho en un campo de texto o sobre texto seleccionado: Cortar,
 * Copiar, Pegar, Seleccionar todo, y las correcciones del corrector.
 *
 * Electron no trae ningún menú contextual: sin esto, el clic derecho en el
 * buscador o en el editor de canciones no hacía nada, y pegar una letra
 * obligaba a saber el atajo de teclado.
 *
 * Los menús de la interfaz (sobre un video, un tema, una canción) los arma la
 * propia pantalla y cancelan el evento; este sólo aparece donde la pantalla no
 * puso uno.
 */
export function instalarMenuEdicion(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_e, p) => {
    const items: MenuItemConstructorOptions[] = []

    // Sugerencias del corrector para la palabra marcada.
    if (p.misspelledWord && p.dictionarySuggestions.length > 0) {
      for (const s of p.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) })
      }
      items.push({ type: 'separator' })
    }

    if (p.isEditable) {
      items.push(
        { label: 'Deshacer', role: 'undo', enabled: p.editFlags.canUndo },
        { label: 'Rehacer', role: 'redo', enabled: p.editFlags.canRedo },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut', enabled: p.editFlags.canCut },
        { label: 'Copiar', role: 'copy', enabled: p.editFlags.canCopy },
        { label: 'Pegar', role: 'paste', enabled: p.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Seleccionar todo', role: 'selectAll', enabled: p.editFlags.canSelectAll }
      )
    } else if (p.selectionText.trim()) {
      items.push({ label: 'Copiar', role: 'copy' })
    }

    if (items.length > 0) Menu.buildFromTemplate(items).popup({ window: win })
  })
}
