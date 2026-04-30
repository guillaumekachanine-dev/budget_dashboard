import { get, set } from 'idb-keyval'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export async function readOfflineValue<T>(key: string): Promise<T | null> {
  try {
    const value = await get<T>(key)
    if (value !== undefined) return value
  } catch {
    // fallback below
  }

  if (!canUseLocalStorage()) return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeOfflineValue<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value)
  } catch {
    // fallback below
  }

  if (!canUseLocalStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}
