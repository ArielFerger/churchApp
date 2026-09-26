import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@/shared/types/ipc'

/**
 * Encontrar el binario y el modelo es la parte del servicio que más se puede
 * romper sin que nadie se entere: la carpeta de herramientas es configurable,
 * cambia entre desarrollo y la app instalada, y whisper —a diferencia de
 * yt-dlp— vive en una subcarpeta con sus DLL. Todo eso se ejercita acá contra
 * carpetas de verdad; lo único que no se prueba es el modelo corriendo.
 */

const raiz = mkdtempSync(join(tmpdir(), 'church-whisper-'))
const tools = join(raiz, 'tools')
const EXE = process.platform === 'win32' ? '.exe' : ''

let settings: AppSettings

vi.mock('electron', () => ({
  app: { getPath: () => raiz, getAppPath: () => raiz }
}))
vi.mock('electron-log', () => ({
  default: { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} }
}))
vi.mock('@electron/services/settingsService', () => ({
  getSettings: () => settings
}))

afterAll(() => {
  rmSync(raiz, { recursive: true, force: true })
})

async function servicio() {
  vi.resetModules()
  return import('@electron/services/escuchaService')
}

function crear(...partes: string[]): void {
  const ruta = join(tools, ...partes)
  mkdirSync(join(ruta, '..'), { recursive: true })
  writeFileSync(ruta, 'x')
}

beforeEach(() => {
  rmSync(tools, { recursive: true, force: true })
  mkdirSync(tools, { recursive: true })
  settings = { toolsFolder: tools, escuchaModelo: null } as AppSettings
})

describe('resolveWhisper', () => {
  it('encuentra el binario y el modelo en la carpeta de whisper', async () => {
    crear('whisper', 'whisper-cli' + EXE)
    crear('whisper', 'modelos', 'ggml-base.bin')

    const { resolveWhisper, queFalta } = await servicio()
    const estado = resolveWhisper()

    expect(estado.binPath).toBe(join(tools, 'whisper', 'whisper-cli' + EXE))
    expect(estado.modelPath).toBe(join(tools, 'whisper', 'modelos', 'ggml-base.bin'))
    expect(estado.modelo).toBe('base')
    expect(queFalta(estado)).toBeNull()
  })

  it('encuentra el servidor, que es el que se usa para escuchar en vivo', async () => {
    crear('whisper', 'whisper-cli' + EXE)
    crear('whisper', 'whisper-server' + EXE)
    crear('whisper', 'modelos', 'ggml-base.bin')

    const { estadoParaLaPantalla } = await servicio()
    const estado = estadoParaLaPantalla()
    expect(estado.serverPath).toBe(join(tools, 'whisper', 'whisper-server' + EXE))
    expect(estado.motor).toBe('servidor')
    expect(estado.servidor).toBe('apagado')
  })

  it('sin servidor, cae al CLI (instalaciones viejas)', async () => {
    crear('whisper', 'whisper-cli' + EXE)
    crear('whisper', 'modelos', 'ggml-base.bin')
    const { estadoParaLaPantalla } = await servicio()
    expect(estadoParaLaPantalla().motor).toBe('cli')
  })

  it('no deja borrar el modelo que está en uso', async () => {
    crear('whisper', 'modelos', 'ggml-base.bin')
    const { borrarModelo } = await servicio()
    await expect(borrarModelo('base')).rejects.toThrow(/en uso/)
  })

  it('acepta el nombre viejo del ejecutable', async () => {
    // whisper.cpp lo llamaba `main` hasta la 1.7. Quien ya lo tenga compilado
    // no tiene por qué bajar otra copia.
    crear('whisper', 'main' + EXE)

    const { resolveWhisper } = await servicio()
    const estado = resolveWhisper()
    expect(estado.binPath).toBe(join(tools, 'whisper', 'main' + EXE))
    expect(estado.modelPath).toBeNull()
  })

  it('encuentra un modelo dejado a mano junto a las otras herramientas', async () => {
    crear('ggml-base.bin')
    const { resolveWhisper } = await servicio()
    expect(resolveWhisper().modelPath).toBe(join(tools, 'ggml-base.bin'))
  })

  it('respeta el modelo elegido en Ajustes', async () => {
    crear('whisper', 'modelos', 'ggml-base.bin')
    crear('whisper', 'modelos', 'ggml-small.bin')
    settings = { toolsFolder: tools, escuchaModelo: 'small' } as AppSettings

    const { resolveWhisper } = await servicio()
    const estado = resolveWhisper()
    expect(estado.modelo).toBe('small')
    expect(estado.modelPath).toBe(join(tools, 'whisper', 'modelos', 'ggml-small.bin'))
    expect(estado.instalados).toEqual(['base', 'small'])
  })

  it('vuelve al modelo recomendado si el ajuste guardado ya no existe', async () => {
    settings = { toolsFolder: tools, escuchaModelo: 'gigante' } as unknown as AppSettings
    const { resolveWhisper } = await servicio()
    expect(resolveWhisper().modelo).toBe('base')
  })

  it('dice qué falta, sin dar por instalado lo que no está', async () => {
    const { resolveWhisper, queFalta } = await servicio()
    const vacio = resolveWhisper()
    expect(vacio.binPath).toBeNull()
    expect(vacio.modelPath).toBeNull()
    expect(vacio.instalados).toEqual([])
    expect(queFalta(vacio)).toMatch(/programa de transcripción y el modelo/)
    expect(vacio.searched.length).toBeGreaterThan(0)
  })

  it('avisa que falta sólo el modelo cuando el programa ya está', async () => {
    crear('whisper', 'whisper-cli' + EXE)
    const { queFalta } = await servicio()
    expect(queFalta()).toMatch(/modelo Base/)
  })
})

describe('transcribirWav', () => {
  it('no intenta transcribir si whisper no está instalado', async () => {
    const { transcribirWav } = await servicio()
    await expect(transcribirWav(join(raiz, 'nada.wav'))).rejects.toThrow(/whisper|modelo/i)
  })

  it('avisa cuando el audio no existe, en vez de spawnear al pedo', async () => {
    crear('whisper', 'whisper-cli' + EXE)
    crear('whisper', 'modelos', 'ggml-base.bin')
    const { transcribirWav } = await servicio()
    await expect(transcribirWav(join(raiz, 'no-esta.wav'))).rejects.toThrow(/No existe el audio/)
  })
})
