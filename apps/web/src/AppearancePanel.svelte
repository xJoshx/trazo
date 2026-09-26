<script lang="ts">
  import { appearanceCss, selectReadingPreset, type AppearanceSettings, type AppearanceTheme, type ReadingPreset } from './appearance'

  export let settings: AppearanceSettings
  export let onChange: (value: AppearanceSettings) => void
  export let onTheme: (value: AppearanceTheme) => void
  export let onReset: () => void
  export let onClose: () => void

  let code: HTMLTextAreaElement
  let cssCode: HTMLTextAreaElement
  let copyStatus = ''
  $: settingsJson = JSON.stringify(settings, null, 2)
  $: settingsCss = appearanceCss(settings)

  function change<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    const next = { ...settings, [key]: value }
    if (key === 'readingFont' || key === 'readingSize' || key === 'readingLeading' || key === 'readingMeasure' || key === 'readingTitleSize') next.readingPreset = 'custom'
    onChange(next)
    copyStatus = ''
  }

  function changeReadingPreset(value: ReadingPreset) {
    onChange(selectReadingPreset(settings, value))
    copyStatus = ''
  }

  async function copySettings() {
    try {
      await navigator.clipboard.writeText(settingsJson)
      copyStatus = 'Copied. Paste these settings into our chat.'
    } catch {
      code.focus()
      code.select()
      copyStatus = 'Selected. Copy the text and paste it into our chat.'
    }
  }

  async function copyCss() {
    try {
      await navigator.clipboard.writeText(settingsCss)
      copyStatus = 'CSS copied. Paste it into apps/web/src/style.css to make these values the source defaults.'
    } catch {
      cssCode.focus()
      cssCode.select()
      copyStatus = 'CSS selected. Copy it into apps/web/src/style.css to make these values the source defaults.'
    }
  }
</script>

<aside class="appearance-panel" aria-label="Appearance workbench">
  <div class="metrics-header">
    <div><strong>Appearance workbench</strong><span class="metrics-live">Temporary preview · reload to discard</span></div>
    <button class="metrics-close" aria-label="Close appearance workbench" on:click={onClose}>×</button>
  </div>
  <div class="metrics-scroll appearance-scroll">
    <section>
      <h2>Reading preview</h2>
      <label class="tune-field"><span>Preset</span><select value={settings.readingPreset} on:change={event => changeReadingPreset(event.currentTarget.value as ReadingPreset)}><option value="substack">Substack</option><option value="bookish">Bookish</option><option value="custom">Custom</option></select></label>
      <label class="tune-field"><span>Body typeface</span><select value={settings.readingFont} on:change={event => change('readingFont', event.currentTarget.value as AppearanceSettings['readingFont'])}><option value="serif">Book serif</option><option value="sans">Sans serif</option></select></label>
      <label class="tune-field"><span>Body size <output>{settings.readingSize}px</output></span><input type="range" min="16" max="30" step="1" value={settings.readingSize} on:input={event => change('readingSize', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Line height <output>{settings.readingLeading.toFixed(2)}</output></span><input type="range" min="1.35" max="2" step="0.05" value={settings.readingLeading} on:input={event => change('readingLeading', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Article width <output>{settings.readingMeasure}px</output></span><input type="range" min="520" max="960" step="20" value={settings.readingMeasure} on:input={event => change('readingMeasure', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Title size <output>{settings.readingTitleSize}px</output></span><input type="range" min="28" max="60" step="1" value={settings.readingTitleSize} on:input={event => change('readingTitleSize', event.currentTarget.valueAsNumber)} /></label>
    </section>

    <section>
      <h2>Writing typography</h2>
      <label class="tune-field"><span>Theme</span><select value={settings.theme} on:change={event => onTheme(event.currentTarget.value as AppearanceTheme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label class="tune-field"><span>Typeface</span><select value={settings.font} on:change={event => change('font', event.currentTarget.value as AppearanceSettings['font'])}><option value="ia-mono">iA Writer Mono</option><option value="system-mono">System mono</option><option value="serif">Book serif</option></select></label>
      <label class="tune-field"><span>Text size <output>{settings.fontSize}px</output></span><input type="range" min="14" max="30" step="1" value={settings.fontSize} on:input={event => change('fontSize', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Line height <output>{settings.lineHeight.toFixed(2)}</output></span><input type="range" min="1.25" max="2.1" step="0.05" value={settings.lineHeight} on:input={event => change('lineHeight', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Writing width <output>{settings.measure}ch</output></span><input type="range" min="48" max="90" step="1" value={settings.measure} on:input={event => change('measure', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Focus fade <output>{Math.round(settings.focusDim * 100)}%</output></span><input type="range" min="0.12" max="0.7" step="0.01" value={settings.focusDim} on:input={event => change('focusDim', event.currentTarget.valueAsNumber)} /></label>
      <label class="tune-field"><span>Caret width <output>{settings.caretWidth}px</output></span><input type="range" min="1" max="5" step="0.5" value={settings.caretWidth} on:input={event => change('caretWidth', event.currentTarget.valueAsNumber)} /></label>
    </section>

    <section>
      <h2>Colors</h2>
      <div class="tune-colors">
        <label><span>Paper</span><code>{settings.paper.toUpperCase()}</code><input aria-label="Paper color" type="color" value={settings.paper} on:input={event => change('paper', event.currentTarget.value)} /></label>
        <label><span>Ink</span><code>{settings.ink.toUpperCase()}</code><input aria-label="Ink color" type="color" value={settings.ink} on:input={event => change('ink', event.currentTarget.value)} /></label>
        <label><span>Muted</span><code>{settings.muted.toUpperCase()}</code><input aria-label="Muted color" type="color" value={settings.muted} on:input={event => change('muted', event.currentTarget.value)} /></label>
        <label><span>Hairlines</span><code>{settings.line.toUpperCase()}</code><input aria-label="Hairline color" type="color" value={settings.line} on:input={event => change('line', event.currentTarget.value)} /></label>
        <label><span>Accent</span><code>{settings.accent.toUpperCase()}</code><input aria-label="Accent color" type="color" value={settings.accent} on:input={event => change('accent', event.currentTarget.value)} /></label>
        <label><span>Caret</span><code>{settings.caret.toUpperCase()}</code><input aria-label="Caret color" type="color" value={settings.caret} on:input={event => change('caret', event.currentTarget.value)} /></label>
        <label><span>Markdown marks</span><code>{settings.syntaxMarker.toUpperCase()}</code><input aria-label="Markdown marker color" type="color" value={settings.syntaxMarker} on:input={event => change('syntaxMarker', event.currentTarget.value)} /></label>
        <label><span>Highlight fill</span><code>{settings.highlightBackground.toUpperCase()}</code><input aria-label="Highlight fill color" type="color" value={settings.highlightBackground} on:input={event => change('highlightBackground', event.currentTarget.value)} /></label>
        <label><span>Tag text</span><code>{settings.tagInk.toUpperCase()}</code><input aria-label="Tag text color" type="color" value={settings.tagInk} on:input={event => change('tagInk', event.currentTarget.value)} /></label>
        <label><span>Tag fill</span><code>{settings.tagBackground.toUpperCase()}</code><input aria-label="Tag fill color" type="color" value={settings.tagBackground} on:input={event => change('tagBackground', event.currentTarget.value)} /></label>
      </div>
    </section>

    <section>
      <h2>Reading colors</h2>
      <div class="tune-colors">
        <label><span>Reading paper</span><code>{settings.readingPaper.toUpperCase()}</code><input aria-label="Reading paper color" type="color" value={settings.readingPaper} on:input={event => change('readingPaper', event.currentTarget.value)} /></label>
        <label><span>Reading text</span><code>{settings.readingInk.toUpperCase()}</code><input aria-label="Reading text color" type="color" value={settings.readingInk} on:input={event => change('readingInk', event.currentTarget.value)} /></label>
        <label><span>Reading muted</span><code>{settings.readingMuted.toUpperCase()}</code><input aria-label="Reading muted color" type="color" value={settings.readingMuted} on:input={event => change('readingMuted', event.currentTarget.value)} /></label>
        <label><span>Reading links</span><code>{settings.readingLink.toUpperCase()}</code><input aria-label="Reading link color" type="color" value={settings.readingLink} on:input={event => change('readingLink', event.currentTarget.value)} /></label>
      </div>
    </section>

    <section>
      <h2>Live CSS source</h2>
      <p class="metrics-note">This code updates as you tune the preview. Copy it into <code>apps/web/src/style.css</code> to make the current values the source defaults.</p>
      <textarea class="tune-json tune-css" readonly bind:this={cssCode} value={settingsCss} aria-label="Generated CSS source defaults"></textarea>
      <div class="tune-actions"><button on:click={copyCss}>Copy CSS</button><button on:click={onReset}>Reset to source</button></div>
    </section>

    <section>
      <h2>Share settings</h2>
      <p class="metrics-note">Or copy the settings as JSON to share a direction. Appearance changes remain in memory and are discarded on reload.</p>
      <textarea class="tune-json" readonly bind:this={code} value={settingsJson} aria-label="Appearance settings JSON"></textarea>
      <div class="tune-actions"><button on:click={copySettings}>Copy JSON</button></div>
      {#if copyStatus}<p class="metrics-note" role="status">{copyStatus}</p>{/if}
    </section>
  </div>
</aside>
