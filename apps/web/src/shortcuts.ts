import init, { resolve_shortcut, shortcut_catalog, shortcut_edit } from './generated/writer_wasm.js'
import type { ShortcutEdit } from './editor'

export interface Shortcut { id: string; label: string; group: string; mac: string; other: string }

let loading: Promise<Shortcut[]> | null = null
let loaded = false

export function loadShortcuts(): Promise<Shortcut[]> {
  loading ??= init().then(() => {
    loaded = true
    return JSON.parse(shortcut_catalog()) as Shortcut[]
  }).catch(error => { loading = null; throw error })
  return loading
}

export function resolveShortcut(event: KeyboardEvent, mac: boolean): string {
  if (!loaded || event.isComposing) return ''
  return resolve_shortcut(event.key, event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, mac)
}

export function shortcutEdit(source: string, from: number, to: number, command: string): ShortcutEdit | null {
  if (!loaded) return null
  return JSON.parse(shortcut_edit(source, from, to, command)) as ShortcutEdit | null
}
