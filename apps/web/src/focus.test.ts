import { describe, expect, it } from 'vitest'
import { ChangeSet, Text } from '@codemirror/state'
import { activeSentenceRange, mapFocusRanges } from './focus'

describe('sentence focus', () => {
  it('separates two sentences on the same visible row', () => {
    const doc = Text.of(['# Day', 'Otra gente. La humanidad es algo increíble.', '', '#diario'])
    const paragraph = { start: doc.line(2).from, end: doc.line(2).to }
    const cursor = doc.line(2).from + 'Otra gente. La humanidad'.length
    expect(activeSentenceRange(doc, cursor, [paragraph])).toEqual({
      start: paragraph.start + 'Otra gente.'.length,
      end: paragraph.end
    })
    expect(activeSentenceRange(doc, cursor, [])).toEqual({
      start: paragraph.start + 'Otra gente.'.length,
      end: paragraph.end
    })
  })

  it('keeps a sentence together across line wraps and soft newlines', () => {
    const doc = Text.of(['# Day', 'Una frase que continúa', 'en otra línea. Otra frase.', '', '#diario'])
    const paragraph = { start: doc.line(2).from, end: doc.line(3).to }
    expect(activeSentenceRange(doc, doc.line(3).from + 4, [paragraph])).toEqual({
      start: paragraph.start,
      end: doc.line(3).from + 'en otra línea.'.length
    })
  })

  it('keeps parsed paragraph boundaries aligned while typing', () => {
    const doc = Text.of(['# Day', 'Primera. Segunda frase', '', '#diario'])
    const paragraph = { start: doc.line(2).from, end: doc.line(2).to }
    const insertion = ' nueva'
    const changes = ChangeSet.of({ from: paragraph.end, insert: insertion }, doc.length)
    const edited = Text.of(['# Day', `Primera. Segunda frase${insertion}`, '', '#diario'])
    expect(activeSentenceRange(edited, edited.line(2).to, mapFocusRanges([paragraph], changes))).toEqual({
      start: paragraph.start + 'Primera.'.length,
      end: paragraph.end + insertion.length
    })
  })

  it('does not split at decimals or inside words', () => {
    const doc = Text.of(['A las 3.14 empieza example.com. Después.'])
    expect(activeSentenceRange(doc, 15, [])).toEqual({ start: 0, end: 'A las 3.14 empieza example.com.'.length })
  })

  it('keeps punctuation clusters and closing quotes in the first sentence', () => {
    const source = 'Dijo «¿Listo?!» Luego seguimos.'
    const doc = Text.of([source])
    expect(activeSentenceRange(doc, source.indexOf('Listo'), [])).toEqual({ start: 0, end: 'Dijo «¿Listo?!»'.length })
    expect(activeSentenceRange(doc, source.indexOf('Luego'), [])).toEqual({ start: 'Dijo «¿Listo?!»'.length, end: source.length })
  })

  it('falls back to heading and blank-line block boundaries before analysis', () => {
    const doc = Text.of(['# Heading', 'Primera frase', 'sigue aquí. Después.', '', 'Última.'])
    expect(activeSentenceRange(doc, doc.line(3).from + 3, [])).toEqual({ start: doc.line(2).from, end: doc.line(3).from + 'sigue aquí.'.length })
    expect(activeSentenceRange(doc, doc.line(1).from + 2, [])).toEqual({ start: doc.line(1).from, end: doc.line(1).to })
    expect(activeSentenceRange(doc, doc.line(5).from + 2, [])).toEqual({ start: doc.line(5).from, end: doc.line(5).to })
  })

  it('uses UTF-16 positions after emoji and keeps trailing whitespace with the previous sentence', () => {
    const source = '🧑‍💻 Hola.  Adiós.'
    const doc = Text.of([source])
    expect(activeSentenceRange(doc, source.length, [])).toEqual({ start: '🧑‍💻 Hola.'.length, end: source.length })
    expect(activeSentenceRange(doc, source.indexOf('Adiós') - 1, [])).toEqual({ start: '🧑‍💻 Hola.'.length, end: source.length })
  })
})
