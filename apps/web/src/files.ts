import type { Draft } from './storage'

export async function readMarkdownFile(file: File): Promise<Pick<Draft, 'filename' | 'text' | 'newline' | 'bom'>> {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error('Choose a Markdown or text file.')
  if (file.size > 10_000_000) throw new Error('This first version accepts files up to 10 MB.')
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer())
  const bom = raw.startsWith('\uFEFF')
  const body = bom ? raw.slice(1) : raw
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  return { filename: file.name, text: body.replace(/\r\n/g, '\n'), newline, bom }
}

export function encodeMarkdown(draft: Draft): Uint8Array {
  const data = (draft.bom ? '\uFEFF' : '') + (draft.newline === '\r\n' ? draft.text.replace(/\n/g, '\r\n') : draft.text)
  return new TextEncoder().encode(data)
}

export function exportMarkdown(draft: Draft): void {
  const url = URL.createObjectURL(new Blob([encodeMarkdown(draft) as BlobPart], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = draft.filename || 'diary.md'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
