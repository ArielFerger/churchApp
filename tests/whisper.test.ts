import { describe, expect, it } from 'vitest'
import {
  buildWhisperArgs,
  explicarErrorWhisper,
  hilosSugeridos,
  modeloPorId,
  modeloUrl,
  parseTranscripcion,
  PROMPT_BIBLICO,
  ultimaLineaUtil,
  WHISPER_MODELS
} from '@/shared/utils/whisper'

/**
 * Lo que se prueba acá es lo que se le pide a whisper y lo que se entiende de
 * su respuesta. El modelo en sí no se toca: son 148 MB y una decisión de
 * diseño —el servicio sólo arma la línea de comando y lee stdout— justamente
 * para que esto se pueda probar sin él.
 */

describe('buildWhisperArgs', () => {
  const base = { modelPath: 'C:\\tools\\ggml-base.bin', wavPath: 'C:\\temp\\v1.wav' }

  it('manda modelo, audio e idioma, y silencia todo lo que no sea el texto', () => {
    const args = buildWhisperArgs(base)
    expect(args).toContain('-m')
    expect(args[args.indexOf('-m') + 1]).toBe(base.modelPath)
    expect(args[args.indexOf('-f') + 1]).toBe(base.wavPath)
    expect(args[args.indexOf('-l') + 1]).toBe('es')
    // Sin marcas de tiempo ni carteles: stdout queda con el texto y nada más.
    expect(args).toContain('-nt')
    expect(args).toContain('-np')
  })

  it('desactiva el reintento por defecto, y lo deja poner de vuelta', () => {
    expect(buildWhisperArgs(base)).toContain('-nf')
    expect(buildWhisperArgs({ ...base, sinFallback: false })).not.toContain('-nf')
  })

  it('pasa el prompt sólo si hay uno', () => {
    const con = buildWhisperArgs({ ...base, prompt: PROMPT_BIBLICO })
    expect(con[con.indexOf('--prompt') + 1]).toBe(PROMPT_BIBLICO)
    expect(buildWhisperArgs({ ...base, prompt: null })).not.toContain('--prompt')
    expect(buildWhisperArgs(base)).not.toContain('--prompt')
  })

  it('pasa los hilos sólo cuando son un número válido', () => {
    const con = buildWhisperArgs({ ...base, hilos: 6 })
    expect(con[con.indexOf('-t') + 1]).toBe('6')
    expect(buildWhisperArgs({ ...base, hilos: 0 })).not.toContain('-t')
  })

  it('no parte las rutas con espacios en varios argumentos', () => {
    // Se spawnea sin shell: la ruta va entera como un argumento. Si alguien
    // "arreglara" esto metiéndole comillas, whisper buscaría un archivo cuyo
    // nombre empieza con comilla.
    const args = buildWhisperArgs({ ...base, wavPath: 'C:\\Mis Cosas\\v 1.wav' })
    expect(args).toContain('C:\\Mis Cosas\\v 1.wav')
  })
})

describe('hilosSugeridos', () => {
  it('le deja núcleos libres a la proyección', () => {
    expect(hilosSugeridos(8)).toBe(6)
    expect(hilosSugeridos(4)).toBe(2)
  })

  it('nunca pide menos de uno ni más de ocho', () => {
    expect(hilosSugeridos(1)).toBe(1)
    expect(hilosSugeridos(2)).toBe(1)
    expect(hilosSugeridos(32)).toBe(8)
  })
})

describe('parseTranscripcion', () => {
  it('saca las marcas de tiempo y junta las líneas', () => {
    const salida = [
      '[00:00:00.000 --> 00:00:03.000]   Abramos en Juan capítulo tres.',
      '[00:00:03.000 --> 00:00:06.000]   Versículo dieciséis.'
    ].join('\n')
    expect(parseTranscripcion(salida)).toBe('Abramos en Juan capítulo tres. Versículo dieciséis.')
  })

  it('tira las anotaciones de ruido', () => {
    // Whisper las emite cuando no hay voz. Si se colaran, el detector las
    // trataría como palabras del predicador.
    const salida = '[BLANK_AUDIO]\n(música)\n[Aplausos]\n*risas*\nVamos a Salmos veintitrés.'
    expect(parseTranscripcion(salida)).toBe('Vamos a Salmos veintitrés.')
  })

  it('tira lo que el modelo inventa sobre el silencio', () => {
    // Medido con el modelo base sobre seis segundos de silencio y de ruido de
    // fondo: siempre contesta algo. Estas dos son las respuestas reales.
    expect(parseTranscripcion('\n [MÚSICA]')).toBe('')
    expect(parseTranscripcion('\n (Cantando)')).toBe('')
  })

  it('colapsa la repetición en bucle sobre el silencio', () => {
    // Sobre casi-silencio whisper repite la misma frase decenas de veces; sin
    // esto el detector vería decenas de menciones distintas de la misma cita.
    const salida = 'Gracias por ver el video.\nGracias por ver el video.\nGracias por ver el video.'
    expect(parseTranscripcion(salida)).toBe('Gracias por ver el video.')
  })

  it('devuelve vacío cuando no hubo nada que transcribir', () => {
    expect(parseTranscripcion('')).toBe('')
    expect(parseTranscripcion('[00:00:00.000 --> 00:00:06.000]   [BLANK_AUDIO]')).toBe('')
  })
})

describe('explicarErrorWhisper', () => {
  it('reconoce el modelo roto o a medio bajar', () => {
    expect(explicarErrorWhisper('whisper_init_from_file: failed to load model')).toMatch(/modelo/i)
  })

  it('reconoce el audio con formato equivocado', () => {
    expect(explicarErrorWhisper('error: failed to open WAV file')).toMatch(/16 kHz/)
  })

  it('no inventa una explicación cuando no la tiene', () => {
    expect(explicarErrorWhisper('algo raro pasó')).toBeNull()
    expect(ultimaLineaUtil('primera\n\nsegunda\n  ')).toBe('segunda')
  })
})

describe('catálogo de modelos', () => {
  it('cae en el recomendado si el ajuste guardado no existe', () => {
    expect(modeloPorId('gigante').id).toBe('base')
    expect(modeloPorId(null).id).toBe('base')
    expect(modeloPorId('small').id).toBe('small')
  })

  it('sólo ofrece modelos multilenguaje', () => {
    // Los `.en` son más chicos y más precisos, pero no entienden castellano.
    for (const m of WHISPER_MODELS) expect(m.archivo).not.toMatch(/\.en\.bin$/)
  })

  it('arma la URL de descarga del modelo', () => {
    expect(modeloUrl('base')).toBe(
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
    )
  })
})
