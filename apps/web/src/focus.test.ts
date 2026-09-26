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
})
