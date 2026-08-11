import { beforeEach, describe, expect, it } from 'vitest'
import { claveSugerencia, useEscuchaStore } from '@/shared/store/escuchaStore'

/**
 * Acá se prueba lo que pasa cuando las ventanas transcritas van llegando: que
 * el solapamiento no duplique sugerencias, que el orden siga al sermón, y que
 * al detener no quede nada del culto anterior.
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

  it('no duplica la cita que aparece en dos ventanas seguidas', () => {
    // Las ventanas se solapan 1,5 s: la frase del borde llega dos veces. Si
    // cada llegada sumara una fila, la lista sería inusable a los diez minutos.
    store().aplicarVentana('vamos a primera de corintios trece')
    store().aplicarVentana('primera de corintios trece, donde Pablo habla del amor')

    expect(store().sugerencias).toHaveLength(1)
    expect(store().ventanas).toHaveLength(2)
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

  it('ignora la ventana vacía pero se queda con la latencia', () => {
    store().aplicarVentana('   ', 900)
    expect(store().ventanas).toHaveLength(0)
    expect(store().sugerencias).toHaveLength(0)
    expect(store().ultimaLatenciaMs).toBe(900)
  })

  it('marca como cortada la cita pegada al final de la ventana', () => {
    // Caso real de la prueba en vivo: la ventana cortó justo en el número y
    // whisper escribió "capítulo 3" donde el audio decía "capítulo 13". Salía
    // con confianza máxima, indistinguible de una cita bien oída.
    store().aplicarVentana('y ahora vamos a primera de corintios capítulo 3')
    expect(store().sugerencias[0]).toMatchObject({ chapter: 3, cortada: true })
    // La confianza no se toca: el reconocedor entendió bien lo que le llegó.
    // Lo que falló fue dónde cayó el corte, y eso se dice aparte.
    expect(store().sugerencias[0].confianza).toBe(1)
  })

  it('marca como cortada la que arranca la ventana', () => {
    // El corte de arriba se lleva el ordinal: "segunda de Corintios" cortada
    // queda en "Corintios", que resuelve a Primera. Es un libro equivocado con
    // cara de cita perfecta.
    store().aplicarVentana('corintios capítulo trece, donde Pablo nos habla del amor')
    expect(store().sugerencias[0].cortada).toBe(true)
  })

  it('deja de estar cortada si después se oye entera', () => {
    // Para esto están los 1,5 s de solape: lo que cae en el borde de una
    // ventana vuelve a caer en el medio de la siguiente.
    store().aplicarVentana('vamos a primera de corintios capítulo 13')
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
    for (let i = 0; i < 60; i++) store().aplicarVentana(`ventana número ${i}`)
    expect(store().ventanas.length).toBeLessThanOrEqual(40)
    // Lo que se conserva es lo último, que es lo que el operador está mirando.
    expect(store().ventanas[store().ventanas.length - 1]).toBe('ventana número 59')
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
      ventanas: [],
      sugerencias: [],
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
    store().aplicarVentana('abramos en juan capítulo tres versículo dieciséis')
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
