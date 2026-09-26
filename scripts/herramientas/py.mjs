// Lanza un script de Python de esta carpeta con el intérprete que haya:
// `py -3` en Windows, `python3` en Linux, `python` como último recurso.
// Lo usan los scripts de npm (`npm run herramientas:estado`), para que el mismo
// comando ande en Windows y en Linux.
//
//   node scripts/herramientas/py.mjs instalar_herramientas.py --estado
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('Uso: node py.mjs <script.py> [argumentos]')
  process.exit(2)
}

const candidatos =
  process.platform === 'win32'
    ? [['py', '-3'], ['python'], ['python3']]
    : [['python3'], ['python']]

for (const [cmd, ...pre] of candidatos) {
  const prueba = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' })
  if (prueba.status !== 0) continue
  const r = spawnSync(cmd, [...pre, join(aqui, script), ...args], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

console.error(
  'No se encontró Python 3. Instalalo desde https://www.python.org/downloads/ ' +
    '(en Linux: sudo apt install python3).'
)
process.exit(1)
