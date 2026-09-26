import { beforeEach, describe, expect, it } from 'vitest'
import { claveSugerencia, useEscuchaStore } from '@/shared/store/escuchaStore'

/**
 * Acá se prueba lo que pasa cuando los fragmentos transcritos van llegando: que
 * una cita repetida no duplique sugerencias, que el orden siga al sermón, que
 * una cita partida entre dos frases se detecte igual, y que al detener no
 * quede nada del culto anterior.
 */

const store = (): ReturnType<typeof useEscuchaStore.getState> => useEscuchaStore.getState()

beforeEach(() => {
  store().limpiar()
})

describe('aplicarVentana', () => {
  it('saca las citas del texto y las suma a las sugerencias', () => {
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis', 1200)

    expect(store().sugerencias).toHaveLength(1)
    expect(store().sugerencias[0]).toMatchObject({ bookId: 'JHN', chapter: 3, verse: 16 })
    expect(store().ultimaLatenciaMs).toBe(1200)
  })

  it('no duplica la cita que aparece en dos fragmentos seguidos', () => {
    // Un corte forzado arrastra el final al fragmento siguiente, y el pastor
    // repite. Si cada llegada sumara una fila, la lista sería inusable.
    store().aplicarVentana('vamos a primera de corintios trece')
    store().aplicarVentana('primera de corintios trece, donde Pablo habla del amor')

    expect(store().sugerencias).toHaveLength(1)
    expect(store().sugerencias[0].veces).toBe(2)
    expect(store().fragmentos).toHaveLength(2)
  })

  it('costura: la cita partida entre dos frases sale entera', () => {
    // El predicador respira en el medio: "vamos a segunda de" | "Corintios 5".
    // Sin la costura, el segundo fragmento sólo tiene "Corintios", que
    // resuelve a PRIMERA. Un libro equivocado con cara de cita perfecta.
    store().aplicarVentana('y ahora vamos a segunda de')
    store().aplicarVentana('Corintios 5:17, si alguno está en Cristo')
    expect(store().sugerencias.map((r) => `${r.bookId} ${r.chapter}:${r.verse}`)).toEqual([
      '2CO 5:17'
    ])
  })

  it('costura: no repite lo que ya estaba entero en el fragmento anterior', () => {
    store().aplicarVentana('abramos en Juan 3:16')
    store().aplicarVentana('porque de tal manera amó Dios al mundo')
    expect(store().sugerencias).toHaveLength(1)
    expect(store().sugerencias[0].veces).toBe(1)
  })

  it('resuelve "el versículo 31" con la cita de un fragmento anterior', () => {
    store().aplicarVentana('Vamos a Romanos 8:28, donde Pablo nos recuerda')
    store().aplicarVentana('que todas las cosas ayudan a bien.')
    store().aplicarVentana('Y quiero que también leamos el versículo 31.')
    const r = store().sugerencias.find((s) => s.verse === 31)
    expect(r).toMatchObject({ bookId: 'ROM', chapter: 8, inferida: true })
  })

  it('lo proyectado pasa a ser el contexto', () => {
    store().marcarEnPantalla({ bookId: 'PSA', chapter: 23, verse: 1 })
    store().aplicarVentana('miren el versículo 4')
    expect(store().sugerencias[0]).toMatchObject({ bookId: 'PSA', chapter: 23, verse: 4 })
  })

  it('con las estadísticas cargadas descarta versículos que no existen', () => {
    store().setEstadisticas({ JHN: [51, 25, 36] })
    store().aplicarVentana('en Juan 3:99 y en Juan 3:36')
    expect(store().sugerencias.map((r) => r.verse)).toEqual([36])
    store().setEstadisticas(null)
  })

  it('ordena las sugerencias como se dijeron, no como llegaron', () => {
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis')
    store().aplicarVentana('y ahora vamos a primera de corintios trece')
    store().aplicarVentana('terminamos leyendo el salmo veintitrés')

    // Sin acumular las palabras de las ventanas previas, las tres arrancarían
    // en offsets parecidos y el orden saldría mezclado.
    expect(store().sugerencias.map((r) => r.bookId)).toEqual(['JHN', '1CO', 'PSA'])
    const offsets = store().sugerencias.map((r) => r.offset)
    expect(offsets[0]).toBeLessThan(offsets[1])
    expect(offsets[1]).toBeLessThan(offsets[2])
  })

  it('ignora el fragmento vacío pero se queda con la latencia', () => {
    store().aplicarVentana('   ', 900)
    expect(store().fragmentos).toHaveLength(0)
    expect(store().sugerencias).toHaveLength(0)
    expect(store().ultimaLatenciaMs).toBe(900)
  })

  it('marca como cortada la cita pegada a un corte forzado', () => {
    // Caso real de la prueba en vivo: el corte cayó justo en el número y
    // whisper escribió "capítulo 3" donde el audio decía "capítulo 13". Salía
    // con confianza máxima, indistinguible de una cita bien oída.
    store().aplicarVentana('y ahora vamos a primera de corintios capítulo 3', 900, { forzado: true })
    expect(store().sugerencias[0]).toMatchObject({ chapter: 3, cortada: true })
    // La confianza no se toca: el reconocedor entendió bien lo que le llegó.
    // Lo que falló fue dónde cayó el corte, y eso se dice aparte.
    expect(store().sugerencias[0].confianza).toBe(1)
  })

  it('una frase cerrada por una pausa no está cortada, aunque la cita quede al final', () => {
    // Con los fragmentos cortados por pausas, que la cita termine la frase es
    // lo normal: "Y cerramos con el Salmo 23." Marcarla sería ruido.
    store().aplicarVentana('Y cerramos con el Salmo 23.')
    expect(store().sugerencias[0].cortada).toBe(false)
  })

  it('deja de estar cortada si después se oye entera', () => {
    // Para esto está el solape del corte forzado: lo que cae en el borde de un
    // fragmento vuelve a caer en el medio del siguiente.
    store().aplicarVentana('vamos a primera de corintios capítulo 13', 900, { forzado: true })
    expect(store().sugerencias[0].cortada).toBe(true)

    store().aplicarVentana('y ahora vamos a primera de corintios capítulo 13, donde Pablo habla')
    expect(store().sugerencias).toHaveLength(1)
    expect(store().sugerencias[0].cortada).toBe(false)
  })

  it('no marca a la que aparece en el medio de la ventana', () => {
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis y leamos juntos')
    expect(store().sugerencias[0]).toMatchObject({ confianza: 1, cortada: false })
  })

  it('no acumula transcripción sin límite', () => {
    for (let i = 0; i < 90; i++) store().aplicarVentana(`fragmento número ${i}`)
    expect(store().fragmentos.length).toBeLessThanOrEqual(60)
    // Lo que se conserva es lo último, que es lo que el operador está mirando.
    expect(store().fragmentos[store().fragmentos.length - 1].texto).toBe('fragmento número 89')
  })

  it('lleva la cuenta de lo que está en vuelo', () => {
    store().fragmentoEnviado()
    store().fragmentoEnviado()
    expect(store().pendientes).toBe(2)
    store().aplicarVentana('hola')
    store().ventanaDescartada()
    expect(store().pendientes).toBe(0)
  })
})

describe('sugerencias', () => {
  it('se pueden sacar de a una', () => {
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis')
    store().descartarSugerencia(claveSugerencia(store().sugerencias[0]))
    expect(store().sugerencias).toHaveLength(0)
  })
})

describe('limpiar', () => {
  it('no deja nada del culto anterior', () => {
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis', 1200)
    store().ventanaDescartada()
    store().setNivel(0.4)

    store().limpiar()

    expect(store()).toMatchObject({
      estado: 'apagada',
      nivel: 0,
      fragmentos: [],
      sugerencias: [],
      contexto: null,
      enPantalla: null,
      ultimaLatenciaMs: null,
      descartadas: 0,
      error: null
    })
  })

  it('olvida qué citas se habían oído enteras', () => {
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis y leamos')
    store().limpiar()
    // Si el recuerdo sobreviviera, la misma cita del culto siguiente llegaría
    // "ya confirmada" aunque esta vez sólo se la haya oído cortada.
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis', 900, {
      forzado: true
    })
    expect(store().sugerencias[0].cortada).toBe(true)
  })

  it('también reinicia el conteo de posiciones', () => {
    store().aplicarVentana('una frase larga cualquiera para correr el contador de palabras')
    store().limpiar()
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis')
    // Si el contador siguiera de la sesión anterior, la primera cita del culto
    // nuevo arrancaría con un offset heredado.
    expect(store().sugerencias[0].offset).toBeLessThan(10)
  })
})

describe('estado', () => {
  it('arrancar de nuevo borra el error anterior', () => {
    store().setError('La entrada de audio está tomada por otro programa.')
    expect(store().estado).toBe('error')

    store().setEstado('iniciando')
    expect(store().error).toBeNull()
  })

  it('cuenta las ventanas que se perdieron por saturación', () => {
    store().ventanaDescartada()
    store().ventanaDescartada()
    expect(store().descartadas).toBe(2)
  })
})

describe('frase provisional', () => {
  it('muestra la cita antes de que termine la frase, sin sumarla a la lista', () => {
    store().aplicarProvisional('y ahora vamos a abrir en Juan 3:16 porque', 1)
    expect(store().provisional?.sugerencias.map((r) => r.bookId)).toEqual(['JHN'])
    expect(store().provisional?.sugerencias[0].provisional).toBe(true)
    expect(store().sugerencias).toHaveLength(0)
  })

  it('la frase completa la reemplaza (lo provisional pudo oír un número a medias)', () => {
    // Provisional cortado justo en el medio del número.
    store().aplicarProvisional('abramos en Juan 3:1', 1)
    expect(store().provisional?.sugerencias[0]).toMatchObject({ verse: 1, cortada: true })

    store().aplicarVentana('abramos en Juan 3:16 porque de tal manera', 800, { frase: 1 })
    expect(store().provisional).toBeNull()
    expect(store().sugerencias.map((r) => `${r.chapter}:${r.verse}`)).toEqual(['3:16'])
  })

  it('una provisional que llega después de su frase completa se ignora', () => {
    store().aplicarVentana('leamos Romanos 8:28', 800, { frase: 3 })
    store().aplicarProvisional('leamos Romanos 8', 3)
    expect(store().provisional).toBeNull()
  })

  it('un corte forzado no cierra la frase: sigue llegando lo provisional', () => {
    store().aplicarVentana('una frase larguísima sin pausas', 800, { frase: 2, forzado: true })
    store().aplicarProvisional('que termina en Salmo 23', 2)
    expect(store().provisional?.sugerencias.map((r) => r.bookId)).toEqual(['PSA'])
  })

  it('no repite en provisional lo que ya está en la lista', () => {
    store().aplicarVentana('abramos en Juan 3:16', 800, { frase: 1 })
    store().aplicarProvisional('como dice Juan 3:16 y además', 2)
    expect(store().provisional?.sugerencias).toEqual([])
  })
})
