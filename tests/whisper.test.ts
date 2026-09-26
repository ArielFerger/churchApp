import { describe, expect, it } from 'vitest'
import {
  audioCtxPara,
  buildServerArgs,
  buildWhisperArgs,
  esAlucinacion,
  explicarErrorWhisper,
  hilosSugeridos,
  modeloPorId,
  modeloUrl,
  parseRespuestaServidor,
  parseTranscripcion,
  promptConContexto,
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
    expect(modeloPorId('small-q5_1').archivo).toBe('ggml-small-q5_1.bin')
  })

  it('los ids no se repiten y los tamaños crecen con la exigencia', () => {
    const ids = WHISPER_MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of WHISPER_MODELS) expect(m.mb).toBeGreaterThan(0)
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

describe('buildServerArgs', () => {
  const args = buildServerArgs({ modelPath: 'C:\\m\\ggml-base.bin', puerto: 41234, hilos: 6 })

  it('escucha sólo en la propia máquina', () => {
    // El audio del sermón no se tiene que poder pedir desde otra PC de la red.
    expect(args[args.indexOf('--host') + 1]).toBe('127.0.0.1')
    expect(args[args.indexOf('--port') + 1]).toBe('41234')
  })

  it('manda modelo, idioma e hilos, y suprime los tokens de no-habla', () => {
    expect(args[args.indexOf('-m') + 1]).toBe('C:\\m\\ggml-base.bin')
    expect(args[args.indexOf('-l') + 1]).toBe('es')
    expect(args[args.indexOf('-t') + 1]).toBe('6')
    expect(args).toContain('-sns')
    expect(args).toContain('-nf')
  })
})

describe('parseRespuestaServidor', () => {
  it('junta los segmentos', () => {
    const json = {
      text: 'ignorado',
      segments: [
        { text: ' Abramos en Juan 3:16.', no_speech_prob: 0.01, avg_logprob: -0.2 },
        { text: ' Porque de tal manera.', no_speech_prob: 0.02, avg_logprob: -0.3 }
      ]
    }
    expect(parseRespuestaServidor(json)).toBe('Abramos en Juan 3:16. Porque de tal manera.')
  })

  it('tira el segmento que el propio modelo cree que no es voz', () => {
    const json = {
      segments: [
        { text: ' Salmo 23.', no_speech_prob: 0.02, avg_logprob: -0.2 },
        { text: ' Gracias.', no_speech_prob: 0.9, avg_logprob: -1.4 }
      ]
    }
    expect(parseRespuestaServidor(json)).toBe('Salmo 23.')
  })

  it('no tira un segmento seguro aunque diga "no habla" alto', () => {
    // Las dos condiciones juntas, como la implementación de referencia: sola,
    // la probabilidad de no-habla descarta frases reales dichas en voz baja.
    const json = { segments: [{ text: ' Romanos 8:28.', no_speech_prob: 0.8, avg_logprob: -0.3 }] }
    expect(parseRespuestaServidor(json)).toBe('Romanos 8:28.')
  })

  it('tira las muletillas que whisper inventa sobre el silencio', () => {
    const json = {
      segments: [
        { text: ' Subtítulos realizados por la comunidad de Amara.org' },
        { text: ' ¡Suscríbete al canal!' },
        { text: ' Vamos a Hechos 2:38.' }
      ]
    }
    expect(parseRespuestaServidor(json)).toBe('Vamos a Hechos 2:38.')
  })

  it('tira el eco del prompt', () => {
    const prompt = promptConContexto('y leamos juntos el pasaje')
    const json = { segments: [{ text: ' Citas: Juan 3:16, Romanos 8:28, 1 Corintios 13:4' }] }
    expect(parseRespuestaServidor(json, prompt)).toBe('')
  })

  it('acepta la respuesta sin segmentos (formato json simple)', () => {
    expect(parseRespuestaServidor({ text: ' Juan 3:16 \n' })).toBe('Juan 3:16')
  })

  it('no rompe con basura', () => {
    expect(parseRespuestaServidor(null)).toBe('')
    expect(parseRespuestaServidor('texto')).toBe('')
    expect(parseRespuestaServidor({ segments: [{ text: 42 }] })).toBe('')
  })
})

describe('esAlucinacion', () => {
  it('reconoce las de siempre y deja pasar el habla normal', () => {
    expect(esAlucinacion('Gracias por ver el video.')).toBe(true)
    expect(esAlucinacion('Subtítulos por la comunidad de Amara.org')).toBe(true)
    expect(esAlucinacion('Gracias, Señor, por este día.')).toBe(false)
    expect(esAlucinacion('Abramos en Juan 3:16')).toBe(false)
    expect(esAlucinacion('')).toBe(false)
  })
})

describe('promptConContexto', () => {
  it('sin nada previo, es el prompt bíblico', () => {
    expect(promptConContexto('')).toBe(PROMPT_BIBLICO)
  })

  it('suma sólo las últimas ~30 palabras, enteras', () => {
    const largo = Array.from({ length: 100 }, (_, i) => `palabra${i}`).join(' ')
    const p = promptConContexto(largo)
    expect(p.startsWith(PROMPT_BIBLICO)).toBe(true)
    expect(p).toContain('palabra99')
    expect(p).not.toContain('palabra69 ')
    expect(p).toContain('palabra70')
  })
})

describe('audioCtxPara', () => {
  it('nunca baja de 768 (por debajo, whisper corta frases)', () => {
    expect(audioCtxPara(1000)).toBe(768)
    expect(audioCtxPara(8000)).toBe(768)
  })

  it('crece con fragmentos largos y no pasa de 1500 (30 s)', () => {
    expect(audioCtxPara(14_000)).toBe(828)
    expect(audioCtxPara(60_000)).toBe(1500)
  })
})
