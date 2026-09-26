import { describe, it, expect } from 'vitest'
import {
  buscarLibro,
  detectarReferencias,
  fusionar,
  leerNumero,
  fonetica,
  leerOrdinal,
  tokenizar,
  type ReferenciaDetectada
} from '../src/shared/utils/escuchaBiblica'

/** Atajo: la primera referencia detectada, o null. */
const primera = (texto: string): ReferenciaDetectada | null =>
  detectarReferencias(texto)[0] ?? null

/** Forma corta para comparar: "JHN 3:16" / "1CO 13" / "JHN 3:16-18". */
const corta = (r: ReferenciaDetectada | null): string | null => {
  if (!r) return null
  const v = r.verse === null ? '' : `:${r.verse}${r.endVerse ? `-${r.endVerse}` : ''}`
  return `${r.bookId} ${r.chapter}${v}`
}

const palabras = (s: string): string[] => s.split(' ')

describe('leerNumero', () => {
  it('lee las unidades y la primera decena', () => {
    expect(leerNumero(palabras('tres'), 0)?.valor).toBe(3)
    expect(leerNumero(palabras('quince'), 0)?.valor).toBe(15)
  })

  it('lee los compuestos de dieci- y veinti-', () => {
    expect(leerNumero(palabras('dieciseis'), 0)?.valor).toBe(16)
    expect(leerNumero(palabras('veintitres'), 0)?.valor).toBe(23)
  })

  it('lee las decenas con "y"', () => {
    const r = leerNumero(palabras('cuarenta y siete'), 0)
    expect(r?.valor).toBe(47)
    expect(r?.consumidas).toBe(3)
  })

  it('lee las centenas, que hacen falta para los Salmos', () => {
    expect(leerNumero(palabras('ciento cuarenta y siete'), 0)?.valor).toBe(147)
    expect(leerNumero(palabras('cien'), 0)?.valor).toBe(100)
    // El versículo más alto de la Biblia es Salmo 119:176.
    expect(leerNumero(palabras('ciento setenta y seis'), 0)?.valor).toBe(176)
  })

  it('acepta dígitos: el reconocedor a veces los escribe así', () => {
    expect(leerNumero(palabras('3'), 0)?.valor).toBe(3)
    expect(leerNumero(palabras('119'), 0)?.valor).toBe(119)
  })

  it('devuelve null cuando no hay número', () => {
    expect(leerNumero(palabras('hermanos'), 0)).toBeNull()
    expect(leerNumero([], 0)).toBeNull()
  })
})

describe('leerOrdinal', () => {
  it('reconoce las tres formas con y sin "de"', () => {
    expect(leerOrdinal(palabras('primera de corintios'), 0)).toEqual({ orden: 1, consumidas: 2 })
    expect(leerOrdinal(palabras('segunda juan'), 0)).toEqual({ orden: 2, consumidas: 1 })
    expect(leerOrdinal(palabras('tercera de juan'), 0)).toEqual({ orden: 3, consumidas: 2 })
  })

  it('devuelve null si no hay ordinal', () => {
    expect(leerOrdinal(palabras('juan'), 0)).toBeNull()
  })
})

describe('buscarLibro', () => {
  it('encuentra el nombre tal cual', () => {
    expect(buscarLibro(palabras('juan'), 0)?.libro.id).toBe('JHN')
    expect(buscarLibro(palabras('apocalipsis'), 0)?.libro.id).toBe('REV')
  })

  it('tolera tildes perdidas, que el reconocedor come seguido', () => {
    expect(buscarLibro(palabras('genesis'), 0)?.libro.id).toBe('GEN')
    expect(buscarLibro(palabras('exodo'), 0)?.libro.id).toBe('EXO')
  })

  it('arma los nombres de varias palabras', () => {
    const r = buscarLibro(palabras('cantar de los cantares'), 0)
    expect(r?.libro.id).toBe('SNG')
    expect(r?.consumidas).toBe(4)
    expect(buscarLibro(palabras('san juan'), 0)?.libro.id).toBe('JHN')
  })

  it('prefiere el nombre más largo cuando hay dos posibles', () => {
    // "cantar" solo también resolvería, pero la forma larga es la correcta.
    expect(buscarLibro(palabras('cantar de los cantares'), 0)?.consumidas).toBe(4)
  })

  it('corrige errores del reconocedor con menor puntaje', () => {
    const r = buscarLibro(palabras('corintos'), 0) // por "corintios"
    expect(r?.libro.id).toBe('1CO')
    expect(r?.puntaje).toBeLessThan(1)
  })

  it('no inventa un libro con cualquier palabra', () => {
    expect(buscarLibro(palabras('hermanos'), 0)).toBeNull()
    expect(buscarLibro(palabras('entonces'), 0)).toBeNull()
  })
})

describe('detectarReferencias — las formas del habla', () => {
  it('la forma completa con capítulo y versículo', () => {
    expect(corta(primera('abramos en juan capítulo tres versículo dieciséis'))).toBe('JHN 3:16')
  })

  it('libro numerado hablado con ordinal', () => {
    expect(corta(primera('vamos a primera de corintios trece'))).toBe('1CO 13')
  })

  it('el ordinal arma la clave numerada, no adivina', () => {
    // El vocabulario tiene "1corintios" pero NO "corintios" suelto. Si el
    // ordinal no se usara para armar la clave, esto acertaría sólo de rebote
    // (por el matcher difuso comiéndose el "de") y con confianza baja.
    const r = primera('en primera de corintios trece cuatro')
    expect(corta(r)).toBe('1CO 13:4')
    expect(r!.confianza).toBe(1)
    expect(r!.fragmento).toContain('primera')
  })

  it('distingue primera de segunda y de tercera', () => {
    expect(corta(primera('en segunda de corintios cinco'))).toBe('2CO 5')
    expect(corta(primera('en tercera de juan uno'))).toBe('3JN 1')
    expect(corta(primera('en primera de pedro cinco siete'))).toBe('1PE 5:7')
  })

  it('un ordinal delante de un libro no numerado se descarta y sigue', () => {
    // No existe "1 Génesis", así que el ordinal no era tal: era parte de la
    // frase ("la primera parte de..."). Lo correcto no es descartar todo sino
    // caer al libro suelto, porque Génesis 3 sí fue nombrado.
    expect(corta(primera('la primera de génesis tres'))).toBe('GEN 3')
  })

  it('capítulo solo, sin versículo', () => {
    const r = primera('leamos el salmo veintitrés')
    expect(corta(r)).toBe('PSA 23')
    expect(r?.verse).toBeNull()
  })

  it('sin decir "capítulo" ni "versículo"', () => {
    expect(corta(primera('en mateo cinco tres'))).toBe('MAT 5:3')
  })

  it('rango de versículos', () => {
    expect(corta(primera('juan tres dieciséis al dieciocho'))).toBe('JHN 3:16-18')
  })

  it('la cita en medio de una frase, no al principio', () => {
    const r = primera('y como bien dice el apóstol en romanos ocho veintiocho hermanos')
    expect(corta(r)).toBe('ROM 8:28')
  })

  it('encuentra varias citas en el mismo tramo', () => {
    const rs = detectarReferencias('leamos juan tres dieciséis y después en romanos doce dos')
    expect(rs.map(corta)).toEqual(['JHN 3:16', 'ROM 12:2'])
  })

  it('guarda el fragmento que la originó, para mostrárselo al operador', () => {
    const r = primera('abramos en juan capítulo tres versículo dieciséis')
    expect(r?.fragmento).toContain('juan')
    expect(r?.fragmento).toContain('dieciséis')
  })
})

describe('detectarReferencias — no inventar', () => {
  it('no dispara con habla suelta sin citas', () => {
    expect(detectarReferencias('buenos días hermanos qué alegría estar acá hoy')).toEqual([])
  })

  it('rechaza capítulos que no existen', () => {
    // Judas tiene un solo capítulo.
    expect(detectarReferencias('judas cinco')).toEqual([])
  })

  it('texto vacío no rompe', () => {
    expect(detectarReferencias('')).toEqual([])
    expect(detectarReferencias('   ')).toEqual([])
  })
})

describe('detectarReferencias — libros que son palabras comunes', () => {
  // Este es el riesgo grande del módulo: "hechos", "números", "reyes",
  // "jueces" y "proverbios" son sustantivos corrientes. Sin trato especial,
  // llenarían la lista de sugerencias falsas durante todo el sermón.

  it('NO dispara con "hechos" usado como palabra común', () => {
    expect(detectarReferencias('los hechos de ese hombre fueron tres')).toEqual([])
  })

  it('NO dispara con "números" usado como palabra común', () => {
    expect(detectarReferencias('estos números dos mil son enormes')).toEqual([])
  })

  it('NO dispara con "reyes" usado como palabra común', () => {
    expect(detectarReferencias('los reyes de aquella época tres veces fallaron')).toEqual([])
  })

  it('SÍ dispara cuando el contexto lo deja claro', () => {
    expect(corta(primera('vamos a hechos capítulo dos versículo cuatro'))).toBe('ACT 2:4')
    expect(corta(primera('leamos en números seis veinticuatro'))).toBe('NUM 6:24')
  })

  it('un libro sin ambigüedad no necesita contexto', () => {
    // "Apocalipsis" no es palabra común: alcanza con nombrarlo.
    expect(corta(primera('apocalipsis veintiuno cuatro'))).toBe('REV 21:4')
  })
})

describe('detectarReferencias — confianza', () => {
  it('la forma explícita tiene más confianza que la escueta', () => {
    const explicita = primera('abramos en juan capítulo tres versículo dieciséis')!
    const escueta = primera('juan tres dieciséis')!
    expect(explicita.confianza).toBeGreaterThan(escueta.confianza)
  })

  it('un libro corregido a mano tiene menos confianza que uno exacto', () => {
    const exacto = primera('en corintios trece')
    const corregido = primera('en corintos trece')
    expect(corregido!.confianza).toBeLessThan(exacto!.confianza)
  })

  it('la confianza nunca se pasa de 1', () => {
    const r = primera('abramos en primera de corintios capítulo trece versículo cuatro')!
    expect(r.confianza).toBeLessThanOrEqual(1)
  })
})

describe('fusionar', () => {
  const ref = (bookId: string, chapter: number, verse: number | null, confianza = 0.7): ReferenciaDetectada =>
    ({ bookId, chapter, verse, confianza, fragmento: '', offset: 0 })

  it('no repite la misma cita', () => {
    // Las ventanas de audio se solapan a propósito, así que la misma cita
    // llega más de una vez. Si cada aparición sumara una fila, a los cinco
    // minutos la lista sería inusable.
    const out = fusionar([ref('JHN', 3, 16)], [ref('JHN', 3, 16)])
    expect(out).toHaveLength(1)
  })

  it('se queda con la lectura de mayor confianza', () => {
    const out = fusionar([ref('JHN', 3, 16, 0.6)], [ref('JHN', 3, 16, 0.9)])
    expect(out[0].confianza).toBe(0.9)
  })

  it('absorbe el capítulo suelto cuando ya hay un versículo de ese capítulo', () => {
    // La fase 1 hacía lo contrario: los dejaba como dos sugerencias distintas.
    // La prueba en vivo de la fase 3 mostró por qué no sirve. Decir "abramos en
    // Juan capítulo tres versículo dieciséis" lleva unos 2,5 s, más que el
    // solape de 1,5 s, así que SIEMPRE va a haber una ventana que corta en
    // "Juan capítulo tres". Con la regla vieja, cada cita con versículo sumaba
    // además una fila con el capítulo pelado. Se pierde poder sugerir el
    // capítulo entero, que es un caso raro y que igual se resuelve desde la
    // sección Biblia.
    const out = fusionar([ref('PSA', 23, null)], [ref('PSA', 23, 1)])
    expect(out).toHaveLength(1)
    expect(out[0].verse).toBe(1)
  })

  it('no toca el capítulo entero si nadie nombró un versículo suyo', () => {
    const out = fusionar([ref('PSA', 23, null)], [ref('JHN', 3, 16)])
    expect(out.map((r) => `${r.bookId} ${r.chapter}:${r.verse ?? '*'}`)).toEqual([
      'PSA 23:*',
      'JHN 3:16'
    ])
  })

  it('tampoco lo absorbe si el versículo es de otro capítulo', () => {
    const out = fusionar([ref('PSA', 23, null)], [ref('PSA', 24, 1)])
    expect(out).toHaveLength(2)
  })

  it('mantiene el orden en que aparecieron', () => {
    const a = { ...ref('JHN', 3, 16), offset: 10 }
    const b = { ...ref('ROM', 8, 28), offset: 2 }
    expect(fusionar([], [a, b]).map((r) => r.bookId)).toEqual(['ROM', 'JHN'])
  })

  it('fusionar con listas vacías no rompe', () => {
    expect(fusionar([], [])).toEqual([])
  })
})

describe('detectarReferencias — como las escribe whisper', () => {
  // Whisper casi nunca deletrea: escribe "Juan 3:16". La primera versión del
  // detector limpiaba el ":" y leía "316", un capítulo que Juan no tiene, así
  // que perdía casi todas las citas reales.

  it('capítulo y versículo con dos puntos', () => {
    expect(corta(primera('Abramos en Juan 3:16.'))).toBe('JHN 3:16')
    expect(corta(primera('Vamos a Romanos 8:28, donde Pablo'))).toBe('ROM 8:28')
  })

  it('con punto o con coma, como en algunas Biblias', () => {
    expect(corta(primera('en Romanos 8.28'))).toBe('ROM 8:28')
    expect(corta(primera('en Juan 3,16'))).toBe('JHN 3:16')
  })

  it('rangos con guion', () => {
    expect(corta(primera('leamos Mateo 5:3-12'))).toBe('MAT 5:3-12')
    expect(corta(primera('en Juan 3:16–18'))).toBe('JHN 3:16-18')
  })

  it('"versículos 16 y 17" es un rango; "16 y 5 hermanos" no', () => {
    expect(corta(primera('Juan 3:16 y 17'))).toBe('JHN 3:16-17')
    expect(corta(primera('en Juan 3:16 y 5 hermanos más'))).toBe('JHN 3:16')
  })

  it('un ":" cuenta como marcador y destraba los libros ambiguos', () => {
    expect(corta(primera('Leemos Hechos 2:38'))).toBe('ACT 2:38')
    expect(corta(primera('lo que dice Números 6:24'))).toBe('NUM 6:24')
  })

  it('los ordinales escritos', () => {
    expect(corta(primera('en 1ª de Corintios 13'))).toBe('1CO 13')
    expect(corta(primera('en 2da de Timoteo 3:16'))).toBe('2TI 3:16')
    expect(corta(primera('en II Reyes 5'))).toBe('2KI 5')
    expect(primera('en 1ª de Corintios 13')!.confianza).toBe(1)
  })

  it('"primer libro de Reyes" y "primera carta a los Corintios"', () => {
    expect(corta(primera('el primer libro de Reyes capítulo 18'))).toBe('1KI 18')
    expect(corta(primera('en la primera carta a los Corintios 13:4'))).toBe('1CO 13:4')
  })

  it('un ordinal con el nombre mal escrito se corrige dentro de los numerados', () => {
    const r = primera('vamos a primera de corintos trece')
    expect(corta(r)).toBe('1CO 13')
    expect(r!.confianza).toBeLessThan(1)
  })

  it('no confunde una hora con un versículo', () => {
    expect(detectarReferencias('nos vemos a las 10:30 en el templo')).toEqual([])
  })

  it('el fragmento y el span salen del texto original, con su puntuación', () => {
    const texto = 'Hoy abramos en Juan 3:16, porque de tal manera'
    const r = primera(texto)!
    expect(r.fragmento).toBe('en Juan 3:16')
    expect(texto.slice(r.span![0], r.span![1])).toBe('Juan 3:16')
  })

  it('el sermón de prueba transcrito por whisper (modelo base)', () => {
    // Salida literal de whisper-server sobre un sermón sintetizado con voz
    // neural argentina. De acá salió el bug de los dos puntos.
    const texto =
      'Buenos días, hermanos, que alegría estar juntos otra vez. Hoy quiero que abramos ' +
      'nuestras Biblias en Juan 3:16, porque de tal manera amódios al mundo, que ha dado a ' +
      'su hijo ni genito. Ahora pensemos un momento en lo que esto significa para nuestra ' +
      'vida diaria. Muchas veces nos sentimos solos, pero la palabra dice otra cosa. Vamos a ' +
      'Romanos 8:28, donde Pablo nos recuerda que todas las cosas ayudan a bien. Y quiero que ' +
      'también leamos el versículo 31. Si Dios es por nosotros, ¿quién contra nosotros? Los ' +
      'hechos de aquel hombre fueron grandes, pero no se comparan con la gracia. Para ' +
      'terminar, busquemos hechos capítulos 2, versículo 38. Y cerramos con el Salmo 23. Amén.'
    expect(detectarReferencias(texto).map(corta)).toEqual([
      'JHN 3:16',
      'ROM 8:28',
      'ROM 8:31',
      'ACT 2:38',
      'PSA 23'
    ])
  })
})

describe('detectarReferencias — por contexto', () => {
  it('"el versículo 31" sigue en el pasaje anterior de la misma frase', () => {
    const rs = detectarReferencias('Romanos 8:28 y ahora el versículo 31')
    expect(rs.map(corta)).toEqual(['ROM 8:28', 'ROM 8:31'])
    expect(rs[1].inferida).toBe(true)
    expect(rs[1].confianza).toBeLessThan(rs[0].confianza)
  })

  it('usa el contexto que viene de antes (otra ventana, o lo que se proyectó)', () => {
    const rs = detectarReferencias('leamos los versículos 31 al 35', {
      contexto: { bookId: 'ROM', chapter: 8 }
    })
    expect(rs.map(corta)).toEqual(['ROM 8:31-35'])
  })

  it('"en el capítulo 5, versículo 1" cambia de capítulo en el mismo libro', () => {
    const rs = detectarReferencias('pasemos al capítulo 5, versículo 1', {
      contexto: { bookId: 'ROM', chapter: 8 }
    })
    expect(rs.map(corta)).toEqual(['ROM 5:1'])
  })

  it('"el capítulo 13 de primera de Corintios": el libro viene después', () => {
    const r = primera('leamos el capítulo 13 de primera de Corintios versículo 4')
    expect(corta(r)).toBe('1CO 13:4')
    expect(r!.inferida).toBeUndefined()
  })

  it('sin contexto, "el versículo 31" no inventa nada', () => {
    expect(detectarReferencias('y ahora el versículo 31')).toEqual([])
  })

  it('un ":" suelto no alcanza para resolver por contexto', () => {
    expect(
      detectarReferencias('a las 10:30', { contexto: { bookId: 'ROM', chapter: 8 } })
    ).toEqual([])
  })
})

describe('detectarReferencias — con la cantidad real de versículos', () => {
  const estadisticas = { JHN: [51, 25, 36], PSA: Array(150).fill(10) }

  it('descarta un versículo que no existe', () => {
    expect(detectarReferencias('Juan 3:99', { estadisticas })).toEqual([])
    expect(corta(primera('Juan 3:36'))).toBe('JHN 3:36')
  })

  it('recorta un rango que se pasa del final del capítulo', () => {
    const [r] = detectarReferencias('Juan 3:34-40', { estadisticas })
    expect(corta(r)).toBe('JHN 3:34-36')
  })
})

describe('tokenizar', () => {
  it('separa los números pegados y recuerda las posiciones', () => {
    const ts = tokenizar('Juan 3:16-18.')
    expect(ts.map((t) => t.norm)).toEqual(['juan', '3', '§v', '16', '§r', '18'])
    expect(ts[3]).toMatchObject({ inicio: 7, fin: 9 })
  })

  it('funde "1ra" y deja "1ª" como el dígito solo', () => {
    expect(tokenizar('1ra de Juan').map((t) => t.norm)).toEqual(['1ra', 'de', 'juan'])
    expect(tokenizar('1ª de Juan').map((t) => t.norm)).toEqual(['1', 'de', 'juan'])
  })
})

describe('detectarReferencias — nombres que el reconocedor escribe mal', () => {
  // Salió de una prueba real: el operador dijo "Job" y whisper escribió "hop".
  // La jota castellana le suena a la hache inglesa.
  it('"hop" es Job cuando el contexto lo deja claro', () => {
    expect(corta(primera('escuchen hop 1:21'))).toBe('JOB 1:21')
    expect(corta(primera('vamos a hop capítulo 19 versículo 25'))).toBe('JOB 19:25')
  })

  it('"hop" suelto no dispara: Job sigue siendo un libro ambiguo', () => {
    expect(detectarReferencias('hicimos hop 3 veces')).toEqual([])
  })

  it('la hache perdida y el seseo', () => {
    expect(corta(primera('en Ageo 2:9'))).toBe('HAG 2:9')
    expect(corta(primera('leamos Ebreos 11:1'))).toBe('HEB 11:1')
    expect(corta(primera('en Sacarías 4:6'))).toBe('ZEC 4:6')
    expect(corta(primera('en Abacuc 2:4'))).toBe('HAB 2:4')
  })

  it('una corrección por sonido tiene menos confianza que el nombre exacto', () => {
    const exacto = primera('Hageo dos nueve')!
    const porSonido = primera('Ageo dos nueve')!
    expect(porSonido.confianza).toBeLessThan(exacto.confianza)
  })

  it('no convierte palabras corrientes en libros', () => {
    expect(detectarReferencias('os digo 3 cosas hermanos')).toEqual([])
    expect(detectarReferencias('buenos días a todos, qué lindo estar acá')).toEqual([])
  })
})

describe('fonetica', () => {
  it('iguala lo que suena igual', () => {
    expect(fonetica('Job')).toBe(fonetica('hop'))
    expect(fonetica('Hageo')).toBe(fonetica('Ageo'))
    expect(fonetica('Zacarías')).toBe(fonetica('Sacarias'))
    expect(fonetica('Hechos')).toBe('echos')
  })
})
