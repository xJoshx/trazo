import type { ChangeDesc, Text } from '@codemirror/state'

export interface FocusRange { start: number; end: number }
const closingMarks = new Set(['"', "'", '”', '’', '»', ')', '}', ']', '*', '_'])

function isHeading(text: string): boolean {
  return /^ {0,3}#{1,6}(?:\s|$)/u.test(text)
}

function localBlock(doc: Text, cursor: number): FocusRange {
  const line = doc.lineAt(cursor)
  if (!line.text.trim() || isHeading(line.text)) return { start: line.from, end: line.to }
  let first = line.number
  let last = line.number
  while (first > 1) {
    const previous = doc.line(first - 1)
    if (!previous.text.trim() || isHeading(previous.text)) break
    first--
  }
  while (last < doc.lines) {
    const next = doc.line(last + 1)
    if (!next.text.trim() || isHeading(next.text)) break
    last++
  }
  return { start: doc.line(first).from, end: doc.line(last).to }
}

export function mapFocusRanges(paragraphs: FocusRange[], changes: ChangeDesc): FocusRange[] {
  return paragraphs.map(paragraph => ({
    start: changes.mapPos(paragraph.start, -1),
    end: changes.mapPos(paragraph.end, 1)
  })).filter(paragraph => paragraph.start < paragraph.end)
}

function isSentenceEnd(text: string, index: number): number | null {
  if (!'.!?'.includes(text[index])) return null
  let next = index + 1
  while (next < text.length && '.!?'.includes(text[next])) next++
  while (next < text.length && closingMarks.has(text[next])) next++
  return next === text.length || /\s/u.test(text[next]) ? next : null
}

export function activeSentenceRange(doc: Text, cursor: number, paragraphs: FocusRange[]): FocusRange {
  const paragraph = paragraphs.find(item => cursor >= item.start && cursor <= item.end) ?? localBlock(doc, cursor)
  const text = doc.sliceString(paragraph.start, paragraph.end)
  const boundaries = [0]
  for (let index = 0; index < text.length; index++) {
    const end = isSentenceEnd(text, index)
    if (end !== null) {
      if (end > boundaries[boundaries.length - 1]) boundaries.push(end)
      index = end - 1
    }
  }
  if (boundaries[boundaries.length - 1] !== text.length) boundaries.push(text.length)

  const position = cursor - paragraph.start
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index]
    const end = boundaries[index + 1]
    if (position < end || index === boundaries.length - 2) {
      if (index > 0 && !text.slice(start, end).trim()) {
        return { start: paragraph.start + boundaries[index - 1], end: paragraph.start + start }
      }
      return { start: paragraph.start + start, end: paragraph.start + end }
    }
  }
  return paragraph
}
