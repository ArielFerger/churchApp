export interface Thumbnail {
  src: string
  duration?: number
}

interface Entry extends Thumbnail {
  key: string
  saved: number
}

const STORE = 'thumbnails'
const MAX_ENTRIES = 512
let database: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('church-media-previews', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'key' })
      store.createIndex('saved', 'saved')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

export async function readThumbnail(key: string): Promise<Thumbnail | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key)
    request.onsuccess = () => resolve(request.result as Entry | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function saveThumbnail(key: string, thumbnail: Thumbnail): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
    const store = tx.objectStore(STORE)
    store.put({ key, ...thumbnail, saved: Date.now() } satisfies Entry)
    const count = store.count()
    count.onsuccess = () => {
      if (count.result <= MAX_ENTRIES) return
      const oldest = store.index('saved').openKeyCursor()
      oldest.onsuccess = () => {
        if (oldest.result) store.delete(oldest.result.primaryKey)
      }
    }
  })
}
