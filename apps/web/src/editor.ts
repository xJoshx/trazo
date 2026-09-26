import { EditorState, StateEffect, StateField, RangeSetBuilder, type Extension } from '@codemirror/state'
import { EditorView, Decoration, keymap, drawSelection, placeholder, type DecorationSet } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands'
import { searchKeymap, openSearchPanel, findNext, findPrevious } from '@codemirror/search'
import type { Analysis, Span } from './analysis'
import { activeSentenceRange, mapFocusRanges, type FocusRange } from './focus'

const replaceSemanticDecorations = StateEffect.define<DecorationSet>()
const semanticDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes)
    for (const effect of transaction.effects) if (effect.is(replaceSemanticDecorations)) value = effect.value
    return value
  },
  provide: (field) => EditorView.decorations.from(field)
})

const replaceFocusDecorations = StateEffect.define<DecorationSet>()
const focusDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes)
    for (const effect of transaction.effects) if (effect.is(replaceFocusDecorations)) value = effect.value
    return value
  },
  provide: (field) => EditorView.decorations.from(field)
})

function buildDecorations(spans: Span[], length: number): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const valid = spans.filter(span => span.start < span.end && span.end <= length)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  for (const span of valid) builder.add(span.start, span.end, Decoration.mark({ class: `md-${span.kind}` }))
  return builder.finish()
}

function wrap(view: EditorView, before: string, after = before): boolean {
  const selection = view.state.selection.main
  const selected = view.state.doc.sliceString(selection.from, selection.to)
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: before + selected + after },
    selection: { anchor: selection.from + before.length, head: selection.from + before.length + selected.length },
    scrollIntoView: true,
    userEvent: 'input.format'
  })
  view.focus()
  return true
}

export interface EditorHooks {
  onChange: (text: string, cursor: number, scrollTop: number) => void
  onCursor: (cursor: number) => void
  onSave: () => void
  onInput: () => void
}

export interface ShortcutEdit { from: number; to: number; insert: string; anchor: number; head: number }

export class WriterEditor {
  view: EditorView
  private extensions: Extension[]
  private focusParagraphs: FocusRange[] = []
  private focus = false
  private focusSentence = ''
  private composing = false
  private queuedAnalysis: Analysis | null = null

  constructor(parent: HTMLElement, text: string, cursor: number, hooks: EditorHooks) {
    const shortcuts: Extension = keymap.of([
      { key: 'Mod-b', run: view => wrap(view, '**') },
      { key: 'Mod-i', run: view => wrap(view, '*') },
      { key: 'Mod-k', run: view => wrap(view, '[', '](https://)') },
      { key: 'Mod-s', run: () => { hooks.onSave(); return true } },
      { key: 'Mod-f', run: openSearchPanel },
      ...searchKeymap, ...historyKeymap, ...defaultKeymap
    ])
    this.extensions = [
      history(), drawSelection(), placeholder('Start writing…'),
      semanticDecorations, focusDecorations, shortcuts,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences' }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          this.focusParagraphs = mapFocusRanges(this.focusParagraphs, update.changes)
          hooks.onInput()
          hooks.onChange(update.state.doc.toString(), update.state.selection.main.head, this.scrollTop)
        }
        if (update.selectionSet || update.docChanged || update.geometryChanged) {
          hooks.onCursor(update.state.selection.main.head)
          if (this.focus) {
            const sentenceChanged = this.refreshFocusDecorations()
            if (sentenceChanged && !update.docChanged) requestAnimationFrame(() => this.centerCursor())
          }
        }
      }),
      EditorView.domEventHandlers({
        compositionstart: () => { this.composing = true },
        compositionend: () => {
          this.composing = false
          if (this.queuedAnalysis) {
            const pending = this.queuedAnalysis
            this.queuedAnalysis = null
            this.setAnalysis(pending)
          }
        }
      })
    ]
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: text,
        selection: { anchor: Math.min(cursor, text.length) },
        extensions: this.extensions
      })
    })
  }

  get text(): string { return this.view.state.doc.toString() }
  get cursor(): number { return this.view.state.selection.main.head }
  get scrollTop(): number { return this.view.dom.closest('.write-pane')?.scrollTop ?? 0 }
  setScrollTop(value: number): void {
    const pane = this.view.dom.closest('.write-pane')
    if (pane) pane.scrollTop = value
  }
  focusEditor(): void { this.view.focus() }
  centerCursor(): void {
    const pane = this.view.dom.closest('.write-pane') as HTMLElement | null
    const caret = this.view.coordsAtPos(this.cursor)
    if (!pane || !caret) return
    const bounds = pane.getBoundingClientRect()
    pane.scrollTop += caret.top - (bounds.top + pane.clientHeight * .5)
  }
  undo(): void { undo(this.view) }
  redo(): void { redo(this.view) }
  find(): void { openSearchPanel(this.view) }
  replaceFind(): void { openSearchPanel(this.view); this.view.dom.querySelector<HTMLInputElement>('.cm-search input[name="replace"]')?.focus() }
  findNext(): void { findNext(this.view) }
  findPrevious(): void { findPrevious(this.view) }
  applyShortcutEdit(edit: ShortcutEdit): void {
    this.view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.anchor, head: edit.head },
      scrollIntoView: true,
      userEvent: 'input.format'
    })
    this.view.focus()
  }
  bold(): void { wrap(this.view, '**') }
  italic(): void { wrap(this.view, '*') }
  link(): void { wrap(this.view, '[', '](https://)') }

  replace(text: string, cursor = 0): void {
    this.focusParagraphs = []
    this.focusSentence = ''
    this.view.setState(EditorState.create({ doc: text, selection: { anchor: Math.min(cursor, text.length) }, extensions: this.extensions }))
    this.setScrollTop(0)
  }

  setFocus(value: boolean): void { this.focus = value; this.focusSentence = ''; this.refreshFocusDecorations() }
  setAnalysis(value: Analysis): void {
    if (this.composing) { this.queuedAnalysis = value; return }
    this.focusParagraphs = value.paragraphs
    this.view.dispatch({ effects: replaceSemanticDecorations.of(buildDecorations([...value.spans, ...value.tags], this.view.state.doc.length)) })
    if (this.focus) this.refreshFocusDecorations()
  }

  private refreshFocusDecorations(): boolean {
    if (!this.focus) {
      this.view.dispatch({ effects: replaceFocusDecorations.of(Decoration.none) })
      return false
    }
    const sentence = activeSentenceRange(this.view.state.doc, this.cursor, this.focusParagraphs)
    const key = `${sentence.start}:${sentence.end}`
    const changed = key !== this.focusSentence
    this.focusSentence = key
    const spans: Span[] = []
    if (sentence.start > 0) spans.push({ start: 0, end: sentence.start, kind: 'dim' })
    if (sentence.end < this.view.state.doc.length) spans.push({ start: sentence.end, end: this.view.state.doc.length, kind: 'dim' })
    this.view.dispatch({ effects: replaceFocusDecorations.of(buildDecorations(spans, this.view.state.doc.length)) })
    return changed
  }

  destroy(): void { this.view.destroy() }
}
