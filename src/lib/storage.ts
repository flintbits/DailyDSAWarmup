import type { FilterMode, SortMode } from '../data/patterns'

const STORAGE_VERSION = 'v1'
export type ProgressRecord = {
  done: boolean
  completedAt: string | null
}

export type Settings = {
  sortMode: SortMode
  filterMode: FilterMode
}

export const DEFAULT_SETTINGS: Settings = {
  sortMode: 'completion',
  filterMode: 'all',
}

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const readRaw = (key: string): string | null => {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

const writeRaw = (key: string, value: string): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(key, value)
  } catch {
    console.warn(`Unable to save localStorage entry: ${key}`)
  }
}

const removeRaw = (key: string): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(key)
  } catch {
    console.warn(`Unable to remove localStorage entry: ${key}`)
  }
}

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (value === null) {
    return fallback
  }

  try {
    return (JSON.parse(value) ?? fallback) as T
  } catch {
    return fallback
  }
}

const progressPrefix = `dsa-tracker:progress:${STORAGE_VERSION}:`
const bookmarkPrefix = `dsa-tracker:bookmark:${STORAGE_VERSION}:`
const notePrefix = `dsa-tracker:note:${STORAGE_VERSION}:`
const settingsKey = `dsa-tracker:settings:${STORAGE_VERSION}`
const metaKey = `dsa-tracker:meta:${STORAGE_VERSION}`

export const readProgressRecord = (subtopicId: string): ProgressRecord => {
  const value = readRaw(`${progressPrefix}${subtopicId}`)
  const fallback: ProgressRecord = { done: false, completedAt: null }
  const record = safeParse<Partial<ProgressRecord> | null>(value, fallback)

  return {
    done: Boolean(record?.done),
    completedAt: typeof record?.completedAt === 'string' ? record.completedAt : null,
  }
}

export const writeProgressRecord = (subtopicId: string, done: boolean): void => {
  const record: ProgressRecord = {
    done,
    completedAt: done ? new Date().toISOString() : null,
  }

  if (!done) {
    removeRaw(`${progressPrefix}${subtopicId}`)
    return
  }

  writeRaw(`${progressPrefix}${subtopicId}`, JSON.stringify(record))
}

export const readBookmark = (subtopicId: string): boolean => {
  const value = readRaw(`${bookmarkPrefix}${subtopicId}`)
  return safeParse<boolean | null>(value, false) === true
}

export const writeBookmark = (subtopicId: string, bookmarked: boolean): void => {
  if (!bookmarked) {
    removeRaw(`${bookmarkPrefix}${subtopicId}`)
    return
  }

  writeRaw(`${bookmarkPrefix}${subtopicId}`, JSON.stringify(true))
}

export const readNote = (subtopicId: string): string => {
  const value = readRaw(`${notePrefix}${subtopicId}`)
  return typeof safeParse<string | null>(value, '') === 'string' ? safeParse<string | null>(value, '') : ''
}

export const writeNote = (subtopicId: string, note: string): void => {
  if (!note.trim()) {
    removeRaw(`${notePrefix}${subtopicId}`)
    return
  }

  writeRaw(`${notePrefix}${subtopicId}`, JSON.stringify(note))
}

export const readSettings = (): Settings => {
  const fallback = DEFAULT_SETTINGS
  const parsed = safeParse<Partial<Settings> | null>(readRaw(settingsKey), fallback)
  return {
    sortMode: parsed?.sortMode === 'alphabetical' || parsed?.sortMode === 'completion' ? parsed.sortMode : fallback.sortMode,
    filterMode: parsed?.filterMode === 'all' || parsed?.filterMode === 'incomplete' || parsed?.filterMode === 'completed' || parsed?.filterMode === 'bookmarked' ? parsed.filterMode : fallback.filterMode,
  }
}

export const writeSettings = (settings: Settings): void => {
  writeRaw(settingsKey, JSON.stringify(settings))
}

export const readMeta = () => {
  const meta = safeParse<{ schemaVersion?: string; updatedAt?: string } | null>(readRaw(metaKey), {
    schemaVersion: STORAGE_VERSION,
    updatedAt: null,
  })

  return {
    schemaVersion: meta?.schemaVersion ?? STORAGE_VERSION,
    updatedAt: meta?.updatedAt ?? null,
  }
}

export const writeMeta = (updatedAt: string): void => {
  writeRaw(metaKey, JSON.stringify({ schemaVersion: STORAGE_VERSION, updatedAt }))
}

export const clearAllProgress = (): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  for (const key of Object.keys(storage)) {
    if (key.startsWith('dsa-tracker:progress:')) {
      storage.removeItem(key)
    }
    if (key.startsWith('dsa-tracker:bookmark:')) {
      storage.removeItem(key)
    }
    if (key.startsWith('dsa-tracker:note:')) {
      storage.removeItem(key)
    }
  }
}

export const exportProgressSnapshot = (payload: Record<string, unknown>) => {
  writeRaw(`dsa-tracker:meta:${STORAGE_VERSION}`, JSON.stringify({
    schemaVersion: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    payload,
  }))
  return payload
}
