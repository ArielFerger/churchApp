import { execFileSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { detectarReferencias, fusionar } from '@/shared/utils/escuchaBiblica'
import type { AppSettings } from '@/shared/types/ipc'

/**
 * Verificación de punta a punta de la fase 2: bajar whisper, transcribir voz de
 * verdad y comprobar que el detector encuentra las citas en lo que salió.
 *
 * NO corre con `npm test`: baja 150 MB y tarda minutos. Se pide a mano:
 *
 *   WHISPER_E2E=1 npx vitest run tests/whisperE2E.test.ts
 *
 * El audio se sintetiza con la voz castellana de Windows (SAPI), así que es
 * repetible y no hace falta grabar nada. Ojo con lo que prueba y lo que no:
 * una voz sintética es más fácil que un predicador real en un salón, así que
 * esto confirma que la cañería funciona, no cuánta precisión va a haber el
 * domingo. Eso se mide en la fase 3, con la consola conectada.
 */

const activo = process.env.WHISPER_E2E === '1' && process.platform === 'win32'

const repo = resolve(process.cwd())
// Las herramientas viven al lado del repo (D:\churchAPP\tools), junto a yt-dlp
// y ffmpeg: el C: de la máquina de la iglesia está casi lleno.
const tools = process.env.WHISPER_TOOLS ?? join(repo, '..', 'tools')

vi.mock('electron', () => ({
  app: { getPath: () => join(tmpdir(), 'church-e2e'), getAppPath: () => repo }
}))
vi.mock('electron-log', () => ({
  default: { warn: console.warn, error: console.error, info: () => {}, debug: () => {} }
}))
vi.mock('@electron/services/settingsService', () => ({
  getSettings: (): AppSettings => ({ toolsFolder: tools, escuchaModelo: null }) as AppSettings
}))

const temp = mkdtempSync(join(tmpdir(), 'church-e2e-'))
const wav = join(temp, 'sermon.wav')

/** Lo que "predica" la voz sintética. Tres citas, en tres formas distintas. */
const SERMON =
  'Buenos dias hermanos. Abramos nuestras Biblias en Juan capitulo tres versiculo dieciseis. ' +
  'Porque de tal manera amo Dios al mundo. ' +
  'Y ahora vamos a primera de Corintios capitulo trece, donde Pablo nos habla del amor. ' +
  'Terminamos leyendo el salmo veintitres. El Senor es mi pastor, nada me faltara.'

/** Texto literal para PowerShell: comillas simples, duplicando las de adentro. */
function psStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Genera el WAV en el formato exacto que whisper exige: 16 kHz, mono, 16 bits. */
function sintetizar(destino: string): void {
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$es = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'es*' } | Select-Object -First 1
if ($es) { $s.SelectVoice($es.VoiceInfo.Name) }
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile(${psStr(destino)}, $fmt)
$s.Rate = -1
$s.Speak(${psStr(SERMON)})
$s.Dispose()`
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true })
}

afterAll(() => {
  rmSync(temp, { recursive: true, force: true })
})

describe.skipIf(!activo)('whisper de punta a punta', () => {
  beforeAll(() => {
    sintetizar(wav)
    expect(existsSync(wav)).toBe(true)
  })

  it(
    'baja whisper y el modelo si faltan',
    async () => {
      const { installWhisper, queFalta } = await import('@electron/services/escuchaService')
      const estado = await installWhisper((paso, ratio) => {
        if (ratio === null || ratio === 1) console.log(`  ${paso}: ${ratio === 1 ? 'ok' : '...'}`)
      })
      expect(queFalta(estado)).toBeNull()
      console.log(`  binario: ${estado.binPath}\n  modelo:  ${estado.modelPath}`)
    },
    30 * 60_000
  )

  it(
    'transcribe el sermón y el detector encuentra las tres citas',
    async () => {
      const { transcribirWav } = await import('@electron/services/escuchaService')
      const { texto, ms, modelo } = await transcribirWav(wav)
      console.log(`  modelo ${modelo}, ${(ms / 1000).toFixed(1)}s\n  «${texto}»`)

      expect(texto.length).toBeGreaterThan(40)

      const refs = fusionar([], detectarReferencias(texto))
      console.log(
        '  detectado: ' +
          refs.map((r) => `${r.bookId} ${r.chapter}:${r.verse ?? '*'} (${r.confianza})`).join(', ')
      )

      const juan = refs.find((r) => r.bookId === 'JHN')
      expect(juan).toMatchObject({ chapter: 3, verse: 16 })
      expect(refs.find((r) => r.bookId === '1CO')).toMatchObject({ chapter: 13 })
      expect(refs.find((r) => r.bookId === 'PSA')).toMatchObject({ chapter: 23 })
    },
    10 * 60_000
  )
})
