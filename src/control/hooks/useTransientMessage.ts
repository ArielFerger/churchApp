import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Un mensaje que se borra solo después de un rato ("✓ Guardado", "3 canciones
 * importadas").
 *
 * Existe para no repetir el patrón de `setMensaje(x)` + `setTimeout(() =>
 * setMensaje(null))` suelto, que deja el timeout vivo si el componente se
 * desmonta antes: React avisa por consola y, peor, si el usuario cambia de
 * sección justo ahí queda una actualización de estado apuntando a un
 * componente que ya no existe. Acá el timeout se cancela al desmontar y cada
 * mensaje nuevo pisa el anterior en vez de acumular temporizadores.
 */
export function useTransientMessage(
  defaultMs = 3000
): [string | null, (mensaje: string | null, ms?: number) => void] {
  const [mensaje, setMensaje] = useState<string | null>(null)
  const handle = useRef<number | null>(null)

  const limpiar = useCallback(() => {
    if (handle.current !== null) {
      window.clearTimeout(handle.current)
      handle.current = null
    }
  }, [])

  useEffect(() => limpiar, [limpiar])

  const mostrar = useCallback(
    (texto: string | null, ms = defaultMs) => {
      limpiar()
      setMensaje(texto)
      if (texto !== null) {
        handle.current = window.setTimeout(() => {
          handle.current = null
          setMensaje(null)
        }, ms)
      }
    },
    [defaultMs, limpiar]
  )

  return [mensaje, mostrar]
}
