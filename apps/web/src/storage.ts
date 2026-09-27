export interface Draft {
  id: string
  filename: string
  text: string
  newline: '\n' | '\r\n'
  bom: boolean
  revision: number
  savedAt: number
  cursor: number
  scrollTop: number
}

export interface Recovery extends Draft {
  recoveryId: string
  reason: 'snapshot' | 'conflict'
}

// Keep the original database name so existing on-device drafts survive the app rename.
const DB_NAME = 'daymark-writer'
const DB_VERSION = 1
const ACTIVE_KEY = 'active'

export function proposedFilename(): string {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.md`
}

export function blankDraft(): Draft {
  return {
    id: crypto.randomUUID(), filename: proposedFilename(), text: '', newline: '\n',
    bom: false, revision: 0, savedAt: 0, cursor: 0, scrollTop: 0
  }
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result)
    value.onerror = () => reject(value.error)
  })
}

function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('Storage transaction failed'))
  })
}

export async function openStore(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) throw new Error('This browser does not provide local draft storage.')
  const open = indexedDB.open(DB_NAME, DB_VERSION)
  open.onupgradeneeded = () => {
    const db = open.result
    if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts')
    if (!db.objectStoreNames.contains('recoveries')) db.createObjectStore('recoveries', { keyPath: 'recoveryId' })
    if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences')
  }
  return request(open)
}

export async function loadDraft(db: IDBDatabase): Promise<Draft | null> {
  const tx = db.transaction('drafts', 'readonly')
  const done = complete(tx)
  const value = await request(tx.objectStore('drafts').get(ACTIVE_KEY)) as Draft | undefined
  await done
  return value ?? null
}

export async function recoveries(db: IDBDatabase): Promise<Recovery[]> {
  const tx = db.transaction('recoveries', 'readonly')
  const done = complete(tx)
  const entries = await request(tx.objectStore('recoveries').getAll()) as Recovery[]
  await done
  return entries.sort((a, b) => b.savedAt - a.savedAt)
}

export async function snapshot(db: IDBDatabase, draft: Draft, reason: Recovery['reason'] = 'snapshot'): Promise<void> {
  if (!draft.text) return
  const tx = db.transaction('recoveries', 'readwrite')
  const done = complete(tx)
  const store = tx.objectStore('recoveries')
  store.put({ ...draft, recoveryId: crypto.randomUUID(), reason, savedAt: Date.now() })
  const all = await request(store.getAll()) as Recovery[]
  if (all.length > 12) {
    all.sort((a, b) => b.savedAt - a.savedAt)
    for (const older of all.slice(12)) store.delete(older.recoveryId)
  }
  await done
}

export class ConflictError extends Error {
  constructor() { super('Another tab changed this draft. Your text was kept as a recovery copy.') }
}

export async function commitDraft(db: IDBDatabase, draft: Draft, expectedRevision: number | null): Promise<void> {
  const tx = db.transaction(['drafts', 'recoveries'], 'readwrite')
  const done = complete(tx)
  const drafts = tx.objectStore('drafts')
  const current = await request(drafts.get(ACTIVE_KEY)) as Draft | undefined
  const same = (current?.revision ?? null) === expectedRevision && (!current || current.id === draft.id)
  if (!same) {
    tx.objectStore('recoveries').put({ ...draft, recoveryId: crypto.randomUUID(), reason: 'conflict', savedAt: Date.now() } satisfies Recovery)
    await done
    throw new ConflictError()
  }
  drafts.put(draft, ACTIVE_KEY)
  await done
}

export async function replaceDraft(db: IDBDatabase, next: Draft, previous: Draft | null, expectedRevision: number | null): Promise<void> {
  const tx = db.transaction(['drafts', 'recoveries'], 'readwrite')
  const done = complete(tx)
  const drafts = tx.objectStore('drafts')
  const current = await request(drafts.get(ACTIVE_KEY)) as Draft | undefined
  if ((current?.revision ?? null) !== expectedRevision || (previous && current?.id !== previous.id)) {
    tx.abort()
    await done.catch(() => {})
    throw new ConflictError()
  }
  if (previous?.text) tx.objectStore('recoveries').put({ ...previous, recoveryId: crypto.randomUUID(), reason: 'snapshot', savedAt: Date.now() } satisfies Recovery)
  drafts.put(next, ACTIVE_KEY)
  await done
}

export async function loadPreference(db: IDBDatabase, key: string): Promise<string | undefined> {
  const tx = db.transaction('preferences', 'readonly')
  const done = complete(tx)
  const value = await request(tx.objectStore('preferences').get(key)) as string | undefined
  await done
  return value
}

export async function savePreference(db: IDBDatabase, key: string, value: string): Promise<void> {
  const tx = db.transaction('preferences', 'readwrite')
  const done = complete(tx)
  tx.objectStore('preferences').put(value, key)
  await done
}
