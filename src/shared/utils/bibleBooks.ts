/**
 * Canonical book table for Spanish Bibles.
 * - id: OSIS-style 3-letter id (stable across versions; key into Bible JSON)
 * - name: Spanish display name
 * - abbreviations: common short forms users might type (lowercased, no accents)
 * - chapters: number of chapters (Protestant canon; matches RVR1909 / RVA-2015)
 */

export type Testament = 'OT' | 'NT'

export interface BookMeta {
  id: string
  name: string
  abbreviations: string[]
  chapters: number
  testament: Testament
}

export const BIBLE_BOOKS: BookMeta[] = [
  // — Antiguo Testamento —
  { id: 'GEN', name: 'Génesis', abbreviations: ['gn', 'gen', 'genesis'], chapters: 50, testament: 'OT' },
  { id: 'EXO', name: 'Éxodo', abbreviations: ['ex', 'exo', 'exodo'], chapters: 40, testament: 'OT' },
  { id: 'LEV', name: 'Levítico', abbreviations: ['lv', 'lev', 'levitico'], chapters: 27, testament: 'OT' },
  { id: 'NUM', name: 'Números', abbreviations: ['nm', 'num', 'numeros'], chapters: 36, testament: 'OT' },
  { id: 'DEU', name: 'Deuteronomio', abbreviations: ['dt', 'deu', 'deut', 'deuteronomio'], chapters: 34, testament: 'OT' },
  { id: 'JOS', name: 'Josué', abbreviations: ['jos', 'josue'], chapters: 24, testament: 'OT' },
  { id: 'JDG', name: 'Jueces', abbreviations: ['jue', 'jueces', 'jc'], chapters: 21, testament: 'OT' },
  { id: 'RUT', name: 'Rut', abbreviations: ['rt', 'rut'], chapters: 4, testament: 'OT' },
  { id: '1SA', name: '1 Samuel', abbreviations: ['1s', '1sa', '1sam', '1samuel'], chapters: 31, testament: 'OT' },
  { id: '2SA', name: '2 Samuel', abbreviations: ['2s', '2sa', '2sam', '2samuel'], chapters: 24, testament: 'OT' },
  { id: '1KI', name: '1 Reyes', abbreviations: ['1r', '1re', '1rey', '1reyes'], chapters: 22, testament: 'OT' },
  { id: '2KI', name: '2 Reyes', abbreviations: ['2r', '2re', '2rey', '2reyes'], chapters: 25, testament: 'OT' },
  { id: '1CH', name: '1 Crónicas', abbreviations: ['1cr', '1cro', '1cron', '1cronicas'], chapters: 29, testament: 'OT' },
  { id: '2CH', name: '2 Crónicas', abbreviations: ['2cr', '2cro', '2cron', '2cronicas'], chapters: 36, testament: 'OT' },
  { id: 'EZR', name: 'Esdras', abbreviations: ['esd', 'esdras'], chapters: 10, testament: 'OT' },
  { id: 'NEH', name: 'Nehemías', abbreviations: ['neh', 'nehemias'], chapters: 13, testament: 'OT' },
  { id: 'EST', name: 'Ester', abbreviations: ['est', 'ester'], chapters: 10, testament: 'OT' },
  { id: 'JOB', name: 'Job', abbreviations: ['job', 'jb'], chapters: 42, testament: 'OT' },
  { id: 'PSA', name: 'Salmos', abbreviations: ['sal', 'salmo', 'salmos', 'sl'], chapters: 150, testament: 'OT' },
  { id: 'PRO', name: 'Proverbios', abbreviations: ['pr', 'pro', 'prov', 'proverbios'], chapters: 31, testament: 'OT' },
  { id: 'ECC', name: 'Eclesiastés', abbreviations: ['ec', 'ecl', 'ecle', 'eclesiastes'], chapters: 12, testament: 'OT' },
  { id: 'SNG', name: 'Cantar de los Cantares', abbreviations: ['ct', 'cant', 'cantar', 'cantares', 'cantardeloscantares'], chapters: 8, testament: 'OT' },
  { id: 'ISA', name: 'Isaías', abbreviations: ['is', 'isa', 'isaias'], chapters: 66, testament: 'OT' },
  { id: 'JER', name: 'Jeremías', abbreviations: ['jer', 'jeremias'], chapters: 52, testament: 'OT' },
  { id: 'LAM', name: 'Lamentaciones', abbreviations: ['lm', 'lam', 'lament', 'lamentaciones'], chapters: 5, testament: 'OT' },
  { id: 'EZK', name: 'Ezequiel', abbreviations: ['ez', 'eze', 'ezeq', 'ezequiel'], chapters: 48, testament: 'OT' },
  { id: 'DAN', name: 'Daniel', abbreviations: ['dn', 'dan', 'daniel'], chapters: 12, testament: 'OT' },
  { id: 'HOS', name: 'Oseas', abbreviations: ['os', 'ose', 'oseas'], chapters: 14, testament: 'OT' },
  { id: 'JOL', name: 'Joel', abbreviations: ['jl', 'joel'], chapters: 3, testament: 'OT' },
  { id: 'AMO', name: 'Amós', abbreviations: ['am', 'amo', 'amos'], chapters: 9, testament: 'OT' },
  { id: 'OBA', name: 'Abdías', abbreviations: ['ab', 'abd', 'abdias'], chapters: 1, testament: 'OT' },
  { id: 'JON', name: 'Jonás', abbreviations: ['jon', 'jonas'], chapters: 4, testament: 'OT' },
  { id: 'MIC', name: 'Miqueas', abbreviations: ['mi', 'miq', 'miqueas'], chapters: 7, testament: 'OT' },
  { id: 'NAM', name: 'Nahúm', abbreviations: ['na', 'nah', 'nahum'], chapters: 3, testament: 'OT' },
  { id: 'HAB', name: 'Habacuc', abbreviations: ['hab', 'habacuc'], chapters: 3, testament: 'OT' },
  { id: 'ZEP', name: 'Sofonías', abbreviations: ['so', 'sof', 'sofonias'], chapters: 3, testament: 'OT' },
  { id: 'HAG', name: 'Hageo', abbreviations: ['hag', 'hageo'], chapters: 2, testament: 'OT' },
  { id: 'ZEC', name: 'Zacarías', abbreviations: ['za', 'zac', 'zacarias'], chapters: 14, testament: 'OT' },
  { id: 'MAL', name: 'Malaquías', abbreviations: ['mal', 'malaquias'], chapters: 4, testament: 'OT' },

  // — Nuevo Testamento —
  { id: 'MAT', name: 'Mateo', abbreviations: ['mt', 'mat', 'mateo', 'sanmateo'], chapters: 28, testament: 'NT' },
  { id: 'MRK', name: 'Marcos', abbreviations: ['mr', 'mc', 'mar', 'marcos', 'sanmarcos'], chapters: 16, testament: 'NT' },
  { id: 'LUK', name: 'Lucas', abbreviations: ['lc', 'luc', 'lucas', 'sanlucas'], chapters: 24, testament: 'NT' },
  { id: 'JHN', name: 'Juan', abbreviations: ['jn', 'jua', 'juan', 'sanjuan'], chapters: 21, testament: 'NT' },
  { id: 'ACT', name: 'Hechos', abbreviations: ['hch', 'hec', 'hechos'], chapters: 28, testament: 'NT' },
  { id: 'ROM', name: 'Romanos', abbreviations: ['ro', 'rm', 'rom', 'romanos'], chapters: 16, testament: 'NT' },
  { id: '1CO', name: '1 Corintios', abbreviations: ['1co', '1cor', '1corintios'], chapters: 16, testament: 'NT' },
  { id: '2CO', name: '2 Corintios', abbreviations: ['2co', '2cor', '2corintios'], chapters: 13, testament: 'NT' },
  { id: 'GAL', name: 'Gálatas', abbreviations: ['ga', 'gal', 'galatas'], chapters: 6, testament: 'NT' },
  { id: 'EPH', name: 'Efesios', abbreviations: ['ef', 'efe', 'efesios'], chapters: 6, testament: 'NT' },
  { id: 'PHP', name: 'Filipenses', abbreviations: ['flp', 'fil', 'fili', 'filipenses'], chapters: 4, testament: 'NT' },
  { id: 'COL', name: 'Colosenses', abbreviations: ['col', 'colosenses'], chapters: 4, testament: 'NT' },
  { id: '1TH', name: '1 Tesalonicenses', abbreviations: ['1ts', '1tes', '1tesalonicenses'], chapters: 5, testament: 'NT' },
  { id: '2TH', name: '2 Tesalonicenses', abbreviations: ['2ts', '2tes', '2tesalonicenses'], chapters: 3, testament: 'NT' },
  { id: '1TI', name: '1 Timoteo', abbreviations: ['1ti', '1tim', '1timoteo'], chapters: 6, testament: 'NT' },
  { id: '2TI', name: '2 Timoteo', abbreviations: ['2ti', '2tim', '2timoteo'], chapters: 4, testament: 'NT' },
  { id: 'TIT', name: 'Tito', abbreviations: ['tit', 'tito'], chapters: 3, testament: 'NT' },
  { id: 'PHM', name: 'Filemón', abbreviations: ['flm', 'fil', 'filemon'], chapters: 1, testament: 'NT' },
  { id: 'HEB', name: 'Hebreos', abbreviations: ['heb', 'hebreos'], chapters: 13, testament: 'NT' },
  { id: 'JAS', name: 'Santiago', abbreviations: ['stg', 'san', 'sant', 'santiago'], chapters: 5, testament: 'NT' },
  { id: '1PE', name: '1 Pedro', abbreviations: ['1p', '1pe', '1ped', '1pedro'], chapters: 5, testament: 'NT' },
  { id: '2PE', name: '2 Pedro', abbreviations: ['2p', '2pe', '2ped', '2pedro'], chapters: 3, testament: 'NT' },
  { id: '1JN', name: '1 Juan', abbreviations: ['1jn', '1ju', '1jua', '1juan'], chapters: 5, testament: 'NT' },
  { id: '2JN', name: '2 Juan', abbreviations: ['2jn', '2ju', '2jua', '2juan'], chapters: 1, testament: 'NT' },
  { id: '3JN', name: '3 Juan', abbreviations: ['3jn', '3ju', '3jua', '3juan'], chapters: 1, testament: 'NT' },
  { id: 'JUD', name: 'Judas', abbreviations: ['jud', 'judas'], chapters: 1, testament: 'NT' },
  { id: 'REV', name: 'Apocalipsis', abbreviations: ['ap', 'apo', 'apoc', 'apocalipsis'], chapters: 22, testament: 'NT' }
]

/** Remove diacritics + lowercase + collapse whitespace. Lookup key. */
export function normalizeBookName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
}

const lookupIndex = (() => {
  const map = new Map<string, BookMeta>()
  for (const book of BIBLE_BOOKS) {
    map.set(normalizeBookName(book.id), book)
    map.set(normalizeBookName(book.name), book)
    for (const abbr of book.abbreviations) map.set(normalizeBookName(abbr), book)
  }
  return map
})()

/** Resolve any reasonable spelling (id, full name, abbreviation) to BookMeta. */
export function findBook(input: string): BookMeta | null {
  return lookupIndex.get(normalizeBookName(input)) ?? null
}

export function bookById(id: string): BookMeta | undefined {
  return BIBLE_BOOKS.find((b) => b.id === id)
}
