export type AppearanceTheme = 'system' | 'light' | 'dark'
export type EditorFont = 'ia-mono' | 'system-mono' | 'serif'
export type ReadingPreset = 'substack' | 'bookish' | 'custom'
export type ReadingFont = 'serif' | 'sans'

export interface AppearanceSettings {
  theme: AppearanceTheme
  readingPreset: ReadingPreset
  readingFont: ReadingFont
  readingSize: number
  readingLeading: number
  readingMeasure: number
  readingTitleSize: number
  readingPaper: string
  readingInk: string
  readingMuted: string
  readingLink: string
  font: EditorFont
  fontSize: number
  lineHeight: number
  measure: number
  focusDim: number
  caretWidth: number
  paper: string
  ink: string
  muted: string
  line: string
  accent: string
  caret: string
  syntaxMarker: string
  highlightBackground: string
  tagInk: string
  tagBackground: string
}

const colorProperties = ['--paper', '--page', '--ink', '--muted', '--line', '--accent', '--toolbar', '--caret', '--syntax-marker', '--highlight-bg', '--tag-ink', '--tag-bg', '--preview-paper', '--preview-ink', '--preview-muted', '--preview-link']
const allProperties = [...colorProperties, '--editor-font', '--editor-size', '--editor-leading', '--measure', '--focus-dim', '--caret-width', '--preview-preset', '--preview-font', '--preview-size', '--preview-leading', '--preview-measure', '--preview-title-size']
const fontFamilies: Record<EditorFont, string> = {
  'ia-mono': "'iA Writer Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  'system-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
  serif: "Charter, 'Bitstream Charter', Georgia, serif"
}
const readingFonts: Record<ReadingFont, string> = {
  serif: "Charter, 'Bitstream Charter', Georgia, serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
}
const readingPresets: Record<Exclude<ReadingPreset, 'custom'>, Pick<AppearanceSettings, 'readingFont' | 'readingSize' | 'readingLeading' | 'readingMeasure' | 'readingTitleSize'>> = {
  substack: { readingFont: 'serif', readingSize: 21, readingLeading: 1.7, readingMeasure: 820, readingTitleSize: 44 },
  bookish: { readingFont: 'serif', readingSize: 19, readingLeading: 1.75, readingMeasure: 720, readingTitleSize: 36 }
}

export function selectReadingPreset(settings: AppearanceSettings, readingPreset: ReadingPreset): AppearanceSettings {
  if (readingPreset === 'custom') return { ...settings, readingPreset }
  return { ...settings, readingPreset, ...readingPresets[readingPreset] }
}

export function appearanceCss(settings: AppearanceSettings): string {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const declarations = [
    ['--page', settings.paper], ['--paper', settings.paper], ['--toolbar', settings.paper],
    ['--ink', settings.ink], ['--muted', settings.muted], ['--line', settings.line], ['--accent', settings.accent],
    ['--caret', settings.caret], ['--syntax-marker', settings.syntaxMarker], ['--highlight-bg', settings.highlightBackground],
    ['--tag-ink', settings.tagInk], ['--tag-bg', settings.tagBackground],
    ['--preview-paper', settings.readingPaper], ['--preview-ink', settings.readingInk],
    ['--preview-muted', settings.readingMuted], ['--preview-link', settings.readingLink],
    ['--preview-preset', settings.readingPreset], ['--preview-font', readingFonts[settings.readingFont]], ['--editor-font', fontFamilies[settings.font]],
    ['--editor-size', `${settings.fontSize}px`], ['--editor-leading', String(settings.lineHeight)],
    ['--measure', `${settings.measure}ch`], ['--focus-dim', String(settings.focusDim)], ['--caret-width', `${settings.caretWidth}px`],
    ['--preview-size', `${settings.readingSize}px`], ['--preview-leading', String(settings.readingLeading)],
    ['--preview-measure', `${settings.readingMeasure}px`], ['--preview-title-size', `${settings.readingTitleSize}px`]
  ] as const
  const body = declarations.map(([name, value]) => `  ${name}: ${value};`).join('\n')
  if (!dark) return `:root {\n${body}\n}`
  return `:root[data-theme='dark'] {\n${body}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']):not([data-theme='dark']) {\n${body.split('\n').map(line => `  ${line}`).join('\n')}\n  }\n}`
}

function cssColor(name: string): string { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() }

export function readAppearance(theme: AppearanceTheme): AppearanceSettings {
  const css = getComputedStyle(document.documentElement)
  return {
    theme,
    readingPreset: (css.getPropertyValue('--preview-preset').trim() as ReadingPreset) || 'substack',
    readingFont: css.getPropertyValue('--preview-font').includes('sans-serif') ? 'sans' : 'serif',
    readingSize: parseFloat(css.getPropertyValue('--preview-size')) || 21,
    readingLeading: parseFloat(css.getPropertyValue('--preview-leading')) || 1.7,
    readingMeasure: parseFloat(css.getPropertyValue('--preview-measure')) || 820,
    readingTitleSize: parseFloat(css.getPropertyValue('--preview-title-size')) || 44,
    readingPaper: cssColor('--preview-paper'), readingInk: cssColor('--preview-ink'),
    readingMuted: cssColor('--preview-muted'), readingLink: cssColor('--preview-link'),
    font: 'ia-mono',
    fontSize: parseFloat(css.getPropertyValue('--editor-size')) || 20,
    lineHeight: parseFloat(css.getPropertyValue('--editor-leading')) || 1.6,
    measure: parseFloat(css.getPropertyValue('--measure')) || 74,
    focusDim: parseFloat(css.getPropertyValue('--focus-dim')) || .24,
    caretWidth: parseFloat(css.getPropertyValue('--caret-width')) || 2,
    paper: cssColor('--paper'), ink: cssColor('--ink'), muted: cssColor('--muted'),
    line: cssColor('--line'), accent: cssColor('--accent'), caret: cssColor('--caret'), syntaxMarker: cssColor('--syntax-marker'),
    highlightBackground: cssColor('--highlight-bg'),
    tagInk: cssColor('--tag-ink'), tagBackground: cssColor('--tag-bg')
  }
}

export function applyAppearance(settings: AppearanceSettings): void {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  const values: Record<string, string> = {
    '--paper': settings.paper, '--page': settings.paper, '--toolbar': settings.paper,
    '--ink': settings.ink, '--muted': settings.muted, '--line': settings.line,
    '--accent': settings.accent, '--caret': settings.caret, '--syntax-marker': settings.syntaxMarker,
    '--highlight-bg': settings.highlightBackground,
    '--tag-ink': settings.tagInk, '--tag-bg': settings.tagBackground,
    '--preview-paper': settings.readingPaper, '--preview-ink': settings.readingInk,
    '--preview-muted': settings.readingMuted, '--preview-link': settings.readingLink,
    '--preview-preset': settings.readingPreset, '--preview-font': readingFonts[settings.readingFont], '--preview-size': `${settings.readingSize}px`,
    '--preview-leading': String(settings.readingLeading), '--preview-measure': `${settings.readingMeasure}px`,
    '--preview-title-size': `${settings.readingTitleSize}px`,
    '--editor-font': fontFamilies[settings.font], '--editor-size': `${settings.fontSize}px`,
    '--editor-leading': String(settings.lineHeight), '--measure': `${settings.measure}ch`,
    '--focus-dim': String(settings.focusDim), '--caret-width': `${settings.caretWidth}px`
  }
  for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value)
}

export function clearAppearance(theme: AppearanceTheme): AppearanceSettings {
  const root = document.documentElement
  for (const name of allProperties) root.style.removeProperty(name)
  root.dataset.theme = theme
  return readAppearance(theme)
}

export function switchAppearanceTheme(settings: AppearanceSettings, theme: AppearanceTheme): AppearanceSettings {
  const root = document.documentElement
  for (const name of colorProperties) root.style.removeProperty(name)
  root.dataset.theme = theme
  const colors = readAppearance(theme)
  return { ...settings, theme, paper: colors.paper, ink: colors.ink, muted: colors.muted,
    line: colors.line, accent: colors.accent, caret: colors.caret, syntaxMarker: colors.syntaxMarker,
    highlightBackground: colors.highlightBackground,
    tagInk: colors.tagInk, tagBackground: colors.tagBackground,
    readingPaper: colors.readingPaper, readingInk: colors.readingInk,
    readingMuted: colors.readingMuted, readingLink: colors.readingLink }
}
