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

  it('normalizes mixed line endings using the first detected CRLF export convention', async () => {
    const imported = await readMarkdownFile(new File(['one\r\ntwo\nthree\r\n'], 'mixed.markdown'))
    expect(imported).toEqual({ filename: 'mixed.markdown', text: 'one\ntwo\nthree\n', newline: '\r\n', bom: false })
    expect(new TextDecoder().decode(encodeMarkdown({ ...blankDraft(), ...imported }))).toBe('one\r\ntwo\r\nthree\r\n')
  })

  it('keeps LF-only Unicode source byte-identical on export', async () => {
    const source = '# Día\nCafé e\u0301 🧑‍💻 中\n'
    const imported = await readMarkdownFile(new File([source], 'día.txt'))
    expect(imported.newline).toBe('\n')
    expect(imported.bom).toBe(false)
    expect(new TextDecoder().decode(encodeMarkdown({ ...blankDraft(), ...imported }))).toBe(source)
  })

  it('rejects unsupported extension and files above the import limit', async () => {
    await expect(readMarkdownFile(new File(['text'], 'notes.rtf'))).rejects.toThrow('Choose a Markdown or text file.')
    await expect(readMarkdownFile(new File([new Uint8Array(10_000_001)], 'large.md'))).rejects.toThrow('up to 10 MB')
  })
})
