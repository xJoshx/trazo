import init, { analyze } from './generated/writer_wasm.js'
import type { Analysis } from './analysis'

let ready: Promise<unknown> | null = null

self.onmessage = async (event: MessageEvent<{ documentId: string; revision: number; text: string; previewRequested: boolean }>) => {
  try {
    ready ??= init()
    await ready
    const { documentId, revision, text, previewRequested } = event.data
    const analysis = JSON.parse(analyze(text, previewRequested)) as Analysis
    self.postMessage({ type: 'result', documentId, revision, analysis })
  } catch (error) {
    ready = null
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Markdown analysis failed.' })
  }
}
