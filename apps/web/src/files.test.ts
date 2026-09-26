import { describe, expect, it } from 'vitest'
import { encodeMarkdown, readMarkdownFile } from './files'
import { blankDraft } from './storage'

describe('Markdown files', () => {
  it('round trips UTF-8, BOM and CRLF without changing the text', async () => {
    const source = '\uFEFF# Día\r\n\r\nCafé y 🧑‍💻\r\n'
    const file = new File([source], 'diario.md', { type: 'text/markdown' })
    const imported = await readMarkdownFile(file)
    expect(imported).toEqual({ filename: 'diario.md', text: '# Día\n\nCafé y 🧑‍💻\n', newline: '\r\n', bom: true })
    const bytes = encodeMarkdown({ ...blankDraft(), ...imported })
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(source)
  })

  it('rejects invalid UTF-8 before replacing the draft', async () => {
    const file = new File([new Uint8Array([0xff])], 'broken.md')
    await expect(readMarkdownFile(file)).rejects.toThrow()
  })
})
