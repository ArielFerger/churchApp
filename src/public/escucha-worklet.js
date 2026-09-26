/**
 * Recolector de audio para la Escucha. Corre en el hilo de audio del sistema.
 *
 * Está acá, en `public/`, y no como un módulo más: la política de seguridad de
 * la app (`script-src 'self'` en control.html) no deja cargar un worklet desde
 * un blob ni desde un data URL, que es el truco habitual. Tiene que ser un
 * archivo servido por la propia app. `public/` se copia tal cual al lado del
 * HTML, así que la misma ruta relativa funciona en desarrollo y empaquetado.
 *
 * Por eso también es JavaScript suelto y no TypeScript: nadie lo compila.
 *
 * Su único trabajo es juntar muestras y mandarlas. Las ventanas, el
 * solapamiento y la puerta por energía se calculan afuera, en
 * `shared/utils/audioVentanas.ts`, donde se pueden testear.
 */
class Recolector extends AudioWorkletProcessor {
  constructor() {
    super()
    // 2048 muestras a 16 kHz son 128 ms: suficientes para no inundar de
    // mensajes al hilo principal, y lo bastante cortas para que el medidor de
    // nivel se mueva como la voz.
    this.buffer = new Float32Array(2048)
    this.usado = 0
  }

  process(inputs) {
    const canal = inputs[0] && inputs[0][0]
    if (!canal) return true
    for (let i = 0; i < canal.length; i++) {
      this.buffer[this.usado++] = canal[i]
      if (this.usado === this.buffer.length) {
        this.port.postMessage(this.buffer.slice())
        this.usado = 0
      }
    }
    return true
  }
}

registerProcessor('recolector', Recolector)
