<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { registerSW } from 'virtual:pwa-register'
  import { WriterEditor } from './editor'
  import { Analyzer } from './analysis'
  import { LiveMetrics, type BuildMetrics } from './metrics'
  import MetricsPanel from './MetricsPanel.svelte'
  import AppearancePanel from './AppearancePanel.svelte'
  import { applyAppearance, clearAppearance, readAppearance, switchAppearanceTheme, type AppearanceSettings, type AppearanceTheme } from './appearance'
  import { blankDraft, commitDraft, ConflictError, loadDraft, loadPreference, openStore, recoveries, replaceDraft, savePreference, snapshot, type Draft, type Recovery } from './storage'
  import { exportMarkdown, readMarkdownFile } from './files'
  import { loadShortcuts, resolveShortcut, shortcutEdit, type Shortcut } from './shortcuts'

  type Mode = 'write' | 'split' | 'read'
  type Theme = 'system' | 'light' | 'dark'

  let editorHost: HTMLDivElement
  let fileInput: HTMLInputElement
  let editor: WriterEditor | null = null
  let analyzer: Analyzer | null = null
  let db: IDBDatabase | null = null
  let current: Draft = blankDraft()
  let persistedRevision: number | null = null
  let savePromise: Promise<void> | null = null
  let saveRequested = false
  let saveStatus = 'Opening draft…'
  let savedStatusTimer: ReturnType<typeof setTimeout> | null = null
  let saveError = ''
  let actionError = ''
  let conflicted = false
  let lastSnapshotAt = 0
  let previewError = ''
  let previewHtml = ''
  let wordCount = 0
  let filename = current.filename
  let mode: Mode = 'write'
  let theme: Theme = 'system'
  let focusMode = false
  let menuOpen = false
  let recoveryOpen = false
  let recoveryItems: Recovery[] = []
  let updateReady = false
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
  let online = navigator.onLine
  let replacing = false
  let editingName = false
  let nameInput = ''
  const metrics = new LiveMetrics()
  let metricsSnapshot = metrics.snapshot()
  let metricsOpen = false
  let buildMetrics: BuildMetrics | null = null
  let buildMetricsLoaded = false
  let appearanceOpen = false
  let appearance: AppearanceSettings | null = null
  let shortcutDialog: HTMLDialogElement
  let shortcutList: Shortcut[] = []
  let shortcutsOpen = false
  const macKeyboard = /Mac|iPhone|iPad/.test(navigator.platform)

  function applyTheme(value: Theme) {
    theme = value
    if (appearance) appearance = clearAppearance(value)
    else document.documentElement.dataset.theme = value
    if (db) void savePreference(db, 'theme', value).catch(() => {})
  }

  function scheduleAnalysis() {
    if (!editor || !analyzer) return
    analyzer.analyze({ documentId: current.id, revision: current.revision, text: editor.text, previewRequested: true })
  }

  function cancelSavedStatus() {
    if (savedStatusTimer !== null) clearTimeout(savedStatusTimer)
    savedStatusTimer = null
  }

  function showSavedAfterQuiet() {
    cancelSavedStatus()
    savedStatusTimer = setTimeout(() => {
      savedStatusTimer = null
      if (!saveError && !conflicted && !saveRequested && current.revision === persistedRevision) saveStatus = 'Saved on this device'
    }, 800)
  }

  function queueSave() {
    cancelSavedStatus()
    if (conflicted) { saveStatus = 'Other tab changed the draft'; return }
    if (!db) { saveStatus = 'Not saved on this device'; saveError = 'Local storage is unavailable. Export a copy of your draft.'; return }
    saveRequested = true
    saveStatus = 'Saving…'
    saveError = ''
    if (!savePromise) savePromise = saveLoop().finally(() => {
      savePromise = null
      if (saveRequested) queueSave()
    })
  }

  async function saveLoop() {
    while (saveRequested && db) {
      saveRequested = false
      const copy = { ...current, savedAt: Date.now(), cursor: editor?.cursor ?? current.cursor, scrollTop: editor?.scrollTop ?? current.scrollTop }
      try {
        const saveStart = performance.now()
        await commitDraft(db, copy, persistedRevision)
        metrics.recordSave(performance.now() - saveStart)
        persistedRevision = copy.revision
        current.savedAt = copy.savedAt
        if (copy.text && Date.now() - lastSnapshotAt > 5 * 60_000) {
          lastSnapshotAt = Date.now()
          void snapshot(db, copy).catch(() => {})
        }
        if (current.id === copy.id && current.revision === copy.revision) showSavedAfterQuiet()
        else saveRequested = true
      } catch (error) {
        cancelSavedStatus()
        saveStatus = error instanceof ConflictError ? 'Other tab changed the draft' : 'Save failed'
        saveError = error instanceof Error ? error.message : 'Local storage failed. Export your draft.'
        conflicted = error instanceof ConflictError
        saveRequested = false
      }
    }
  }

  function onDocumentChange(text: string, cursor: number, scrollTop: number) {
    if (replacing) return
    current.text = text
    current.cursor = cursor
    current.scrollTop = scrollTop
    current.revision += 1
    wordCount = text.trim() ? text.trim().split(/\s+/u).length : 0
    queueSave()
    scheduleAnalysis()
  }

  function saveNow() {
    if (!editor) return
    current.cursor = editor.cursor
    current.scrollTop = editor.scrollTop
    if (current.revision === persistedRevision) { cancelSavedStatus(); saveStatus = 'Saved on this device' }
    else queueSave()
  }

  function syncFilename(value: string) {
    const clean = value.trim().replace(/[\\/:*?"<>|]/g, '-')
    if (!clean) return
    const next = /\.(md|markdown|txt)$/i.test(clean) ? clean : `${clean}.md`
    if (next === filename) { editingName = false; return }
    filename = next
    current.filename = filename
    current.revision += 1
    editingName = false
    queueSave()
  }

  function exportCurrent() {
    current.text = editor?.text ?? current.text
    exportMarkdown(current)
    menuOpen = false
  }

  async function replaceWith(next: Draft) {
    if (!db) throw new Error('Local storage is unavailable; export your current draft first.')
    if (savePromise) await savePromise
    if (saveError || conflicted || current.revision !== persistedRevision) throw new Error('Your latest changes are not saved. Export your current draft before replacing it.')
    await replaceDraft(db, next, current, persistedRevision)
    persistedRevision = next.revision
    current = next
    filename = next.filename
    wordCount = next.text.trim() ? next.text.trim().split(/\s+/u).length : 0
    replacing = true
    editor?.replace(next.text, next.cursor)
    replacing = false
    cancelSavedStatus()
    saveStatus = 'Saved on this device'
    saveError = ''
    actionError = ''
    conflicted = false
    previewHtml = ''
    scheduleAnalysis()
  }

  async function newDraft() {
    menuOpen = false
    try { await replaceWith(blankDraft()); mode = 'write'; editor?.focusEditor() }
    catch (error) { actionError = error instanceof Error ? error.message : 'Could not start a new draft.' }
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    menuOpen = false
    if (!file) return
    try {
      const imported = await readMarkdownFile(file)
      await replaceWith({ ...blankDraft(), ...imported })
      mode = 'write'
      editor?.focusEditor()
    } catch (error) { actionError = error instanceof Error ? error.message : 'Import failed.' }
  }

  async function showRecovery() {
    menuOpen = false
    if (!db) return
    try { recoveryItems = await recoveries(db); recoveryOpen = true }
    catch { actionError = 'Could not read recovery copies.' }
  }

  async function restore(item: Recovery) {
    try {
      await replaceWith({ ...blankDraft(), filename: item.filename, text: item.text, newline: item.newline, bom: item.bom })
      recoveryOpen = false
      mode = 'write'
    } catch (error) { actionError = error instanceof Error ? error.message : 'Could not restore this copy.' }
  }

  async function applyUpdate() {
    if (savePromise) await savePromise
    if (saveError || conflicted || current.revision !== persistedRevision) {
      actionError = 'Save or export the current draft before updating.'
      return
    }
    await updateSW?.(true)
  }

  function retryPreview() {
    previewError = ''
    analyzer?.restart()
    scheduleAnalysis()
  }

  function toggleMetrics() {
    metricsOpen = !metricsOpen
    menuOpen = false
    if (metricsOpen) {
      appearanceOpen = false
      metrics.open()
      if (!buildMetricsLoaded) {
        buildMetricsLoaded = true
        void fetch('/build-metrics.json').then(async response => {
          if (response.ok) buildMetrics = await response.json() as BuildMetrics
        }).catch(() => {})
      }
    } else metrics.close()
  }

  function toggleAppearance() {
    appearanceOpen = !appearanceOpen
    menuOpen = false
    if (appearanceOpen) {
      if (metricsOpen) { metricsOpen = false; metrics.close() }
      appearance ??= readAppearance(theme)
    }
  }

  function changeAppearance(value: AppearanceSettings) {
    appearance = value
    applyAppearance(value)
    editor?.view.requestMeasure()
  }

  function changeAppearanceTheme(value: AppearanceTheme) {
    if (appearance) changeAppearance(switchAppearanceTheme(appearance, value))
  }

  function resetAppearance() {
    appearance = clearAppearance(theme)
    editor?.view.requestMeasure()
  }

  async function toggleFocus() {
    focusMode = !focusMode
    if (focusMode) mode = 'write'
    menuOpen = false
    await tick()
    editor?.setFocus(focusMode)
    editor?.focusEditor()
    if (focusMode) editor?.centerCursor()
  }

  async function showShortcuts() {
    menuOpen = false
    shortcutsOpen = true
    await tick()
    shortcutDialog?.showModal()
  }

  function closeShortcuts() {
    shortcutDialog?.close()
    shortcutsOpen = false
    editor?.focusEditor()
  }

  function runShortcut(id: string) {
    if (id === 'help') { void showShortcuts(); return }
    if (id === 'new') { void newDraft(); return }
    if (id === 'open') { fileInput.click(); return }
    if (id === 'save') { saveNow(); return }
    if (id === 'export') { exportCurrent(); return }
    if (id === 'focus') { void toggleFocus(); return }
    if (id === 'preview') { mode = mode === 'read' ? 'write' : 'read'; return }
    if (id === 'appearance') { applyTheme(theme === 'dark' ? 'light' : 'dark'); return }
    if (id === 'find') { editor?.find(); return }
    if (id === 'replace') { editor?.replaceFind(); return }
    if (id === 'next') { editor?.findNext(); return }
    if (id === 'previous') { editor?.findPrevious(); return }
    if (id === 'undo') { editor?.undo(); return }
    if (id === 'redo') { editor?.redo(); return }
    if (!editor) return
    if (mode === 'read') mode = 'write'
    const selection = editor.view.state.selection.main
    const edit = shortcutEdit(editor.text, selection.from, selection.to, id)
    if (edit) editor.applyShortcutEdit(edit)
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (shortcutsOpen) return
    if (event.key === 'Escape') {
      if (appearanceOpen) { event.preventDefault(); toggleAppearance(); return }
      if (metricsOpen) { event.preventDefault(); toggleMetrics(); return }
      if (focusMode && !recoveryOpen && !menuOpen) { event.preventDefault(); void toggleFocus() }
      recoveryOpen = false
      menuOpen = false
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      void toggleFocus()
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
      event.preventDefault()
      toggleMetrics()
      return
    }
    const id = resolveShortcut(event, macKeyboard)
    if (id && (!(event.target instanceof HTMLInputElement) || ['help', 'save'].includes(id))) {
      event.preventDefault()
      runShortcut(id)
    }
  }

  function handleWindowClick(event: MouseEvent) {
    if (menuOpen && event.target instanceof Element && !event.target.closest('.menu-wrap')) menuOpen = false
  }

  onMount(() => {
    let disposed = false
    metrics.onUpdate = value => { metricsSnapshot = value }
    metrics.start()
    requestAnimationFrame(() => metrics.markScreen())
    const updateOnline = () => { online = navigator.onLine }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('keydown', handleWindowKeydown, true)
    void loadShortcuts().then(value => { shortcutList = value }).catch(() => { actionError = 'Keyboard shortcuts could not load.' })
    updateSW = registerSW({ onNeedRefresh() { updateReady = true } })
    async function start() {
      try {
        db = await openStore()
        const stored = await loadDraft(db)
        if (stored) { current = stored; persistedRevision = stored.revision }
        else { current = blankDraft(); await commitDraft(db, current, null); persistedRevision = 0 }
        const savedTheme = await loadPreference(db, 'theme')
        if (savedTheme === 'light' || savedTheme === 'dark') applyTheme(savedTheme)
        if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {})
      } catch (error) {
        saveError = error instanceof Error ? error.message : 'Local storage could not open.'
        saveStatus = 'Not saved on this device'
      }
      if (disposed) return
      filename = current.filename
      wordCount = current.text.trim() ? current.text.trim().split(/\s+/u).length : 0
      if (!saveError) saveStatus = 'Saved on this device'
      editor = new WriterEditor(editorHost, current.text, current.cursor, {
        onChange: onDocumentChange,
        onCursor: cursor => { current.cursor = cursor },
        onSave: saveNow,
        onInput: () => metrics.recordInput()
      })
      requestAnimationFrame(() => metrics.markInteractive())
      editor.setScrollTop(current.scrollTop)
      analyzer = new Analyzer()
      analyzer.onResult = ({ documentId, revision, analysis, durationMs }) => {
        metrics.recordAnalysis(durationMs)
        if (documentId !== current.id || revision !== current.revision) return
        previewError = ''
        wordCount = analysis.word_count
        previewHtml = analysis.preview_html ?? ''
        editor?.setAnalysis(analysis)
      }
      analyzer.onError = message => { previewError = message }
      scheduleAnalysis()
      void document.fonts.ready.then(() => editor?.view.requestMeasure())
      editor.focusEditor()
    }
    void start()
    return () => {
      disposed = true
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('keydown', handleWindowKeydown, true)
      analyzer?.destroy()
      editor?.destroy()
      db?.close()
      cancelSavedStatus()
      metrics.destroy()
    }
  })
</script>

<svelte:window on:click={handleWindowClick} />

<svelte:head>
  <meta name="color-scheme" content="light dark" />
</svelte:head>

<div class:focus-mode={focusMode} class:inspector-open={metricsOpen || appearanceOpen} class="app-shell">
  <header class="toolbar">
    <div class="brand" aria-label="Daymark Writer"><span class="brand-mark" aria-hidden="true">✳</span><span class="brand-name">daymark</span></div>
    <div class="document-name">
      {#if editingName}
        <input class="name-input" bind:value={nameInput} aria-label="Document filename" on:keydown={event => { if (event.key === 'Enter') syncFilename(nameInput); if (event.key === 'Escape') editingName = false }} on:blur={() => syncFilename(nameInput)} />
      {:else}
        <button class="name-button" title="Rename document" on:click={() => { nameInput = filename; editingName = true }}>{filename}<span aria-hidden="true">⌄</span></button>
      {/if}
    </div>
    <div class="toolbar-spacer"></div>
    <nav class="mode-switch" aria-label="View mode">
      <button class:active={mode === 'write'} aria-pressed={mode === 'write'} on:click={() => mode = 'write'}>Write</button>
      <button class:active={mode === 'split'} class="split-button" aria-pressed={mode === 'split'} on:click={() => mode = 'split'}>Split</button>
      <button class:active={mode === 'read'} aria-pressed={mode === 'read'} on:click={() => mode = 'read'}>Read</button>
    </nav>
    <button class:active={focusMode} class="icon-button focus-button" title="Focus mode (⌘D / Ctrl+D)" aria-label="Focus mode" aria-pressed={focusMode} on:click={toggleFocus}>◎</button>
    <div class="menu-wrap">
      <button class="icon-button menu-button" aria-label="Document actions" aria-expanded={menuOpen} on:click={() => menuOpen = !menuOpen}>•••</button>
      {#if menuOpen}
        <div class="menu" role="menu">
          <button role="menuitem" on:click={() => { menuOpen = false; fileInput.click() }}>Import Markdown…</button>
          <button role="menuitem" on:click={exportCurrent}>Export Markdown</button>
          <button role="menuitem" on:click={newDraft}>New draft</button>
          <button role="menuitem" on:click={showRecovery}>Recovery copies…</button>
          <button role="menuitem" on:click={toggleMetrics}>Performance metrics…</button>
          <button role="menuitem" on:click={toggleAppearance}>Appearance workbench…</button>
          <button role="menuitem" on:click={showShortcuts}>Keyboard shortcuts…</button>
          <div class="menu-divider"></div>
          <div class="menu-label">Appearance</div>
          <div class="theme-choices">
            <button class:chosen={theme === 'system'} on:click={() => { applyTheme('system'); menuOpen = false }}>System</button>
            <button class:chosen={theme === 'light'} on:click={() => { applyTheme('light'); menuOpen = false }}>Light</button>
            <button class:chosen={theme === 'dark'} on:click={() => { applyTheme('dark'); menuOpen = false }}>Dark</button>
          </div>
        </div>
      {/if}
    </div>
    <input bind:this={fileInput} class="visually-hidden" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" on:change={importFile} aria-label="Import Markdown file" />
  </header>

  <main class:read-mode={mode === 'read'} class:split-mode={mode === 'split'} class="workspace">
    <section class="write-pane" aria-label="Markdown editor">
      <div class="writing-column" bind:this={editorHost}></div>
    </section>
    <section class="read-pane" aria-label="Reading preview">
      <article class="prose">
        {#if previewError}
          <div class="preview-message" role="alert">Preview unavailable. <button on:click={retryPreview}>Retry</button><small>{previewError}</small></div>
        {:else if previewHtml}
          {@html previewHtml}
        {:else}
          <p class="preview-empty">Your words will appear here.</p>
        {/if}
      </article>
    </section>
  </main>

  <footer class="statusbar">
    <div class="status-left">
      <span class:error={!!saveError} class="save-indicator" role="status"><span class="status-dot"></span>{saveStatus}</span>
      {#if !online}<span class="offline-label">Offline</span>{/if}
    </div>
    <div class="status-right">
      <button class="format-action" title="Undo" on:click={() => editor?.undo()}>Undo</button>
      <button class="format-action" title="Redo" on:click={() => editor?.redo()}>Redo</button>
      <button class="format-action" title="Find in document" on:click={() => editor?.find()}>Find</button>
      <button class="format-action" title="Bold (⌘B / Ctrl+B)" on:click={() => editor?.bold()}><strong>B</strong></button>
      <button class="format-action" title="Italic (⌘I / Ctrl+I)" on:click={() => editor?.italic()}><em>I</em></button>
      <button class="format-action" title="Link (⌘K / Ctrl+K)" on:click={() => editor?.link()}>Link</button>
      <button class="metrics-toggle" title="Performance metrics (⌘⇧M / Ctrl+Shift+M)" aria-label="Performance metrics" aria-expanded={metricsOpen} on:click={toggleMetrics}>▥</button>
      <button class="metrics-toggle tune-toggle" title="Appearance workbench" aria-label="Appearance workbench" aria-expanded={appearanceOpen} on:click={toggleAppearance}>Aa</button>
      <button class="metrics-toggle shortcut-toggle" title="Keyboard shortcuts (⌘/ / Ctrl+?)" aria-label="Keyboard shortcuts" on:click={showShortcuts}>?</button>
      <span class="word-count">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
    </div>
  </footer>
  {#if focusMode}
    <button class="exit-focus" aria-label="Exit focus mode" title="Exit focus mode (Esc)" on:click={toggleFocus}>×</button>
  {/if}
  {#if saveError}<div class="error-banner" role="alert">{saveError} <button on:click={exportCurrent}>Export a copy</button></div>{/if}
  {#if actionError}<div class="error-banner" role="alert">{actionError} <button on:click={() => actionError = ''}>Dismiss</button></div>{/if}
  {#if updateReady}<div class="update-banner" role="status">An update is ready. <button on:click={applyUpdate}>Save and update</button></div>{/if}
  {#if metricsOpen}<MetricsPanel snapshot={metricsSnapshot} build={buildMetrics} onClose={toggleMetrics} />{/if}
  {#if appearanceOpen && appearance}<AppearancePanel settings={appearance} onChange={changeAppearance} onTheme={changeAppearanceTheme} onReset={resetAppearance} onClose={toggleAppearance} />{/if}
</div>

{#if recoveryOpen}
  <div class="dialog-backdrop" role="presentation" on:click={() => recoveryOpen = false}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Recovery copies">
    <div class="dialog-header"><h2>Recovery copies</h2><button class="icon-button" aria-label="Close" on:click={() => recoveryOpen = false}>×</button></div>
    <p>Restoring a copy saves your current draft in recovery first.</p>
    {#if recoveryItems.length === 0}<p>No recovery copies yet.</p>{/if}
    <ul>
      {#each recoveryItems as item (item.recoveryId)}
        <li><div><strong>{item.filename}</strong><small>{new Date(item.savedAt).toLocaleString()} · {item.reason}</small><span>{item.text.slice(0, 100) || 'Empty draft'}</span></div><button on:click={() => restore(item)}>Restore</button></li>
      {/each}
    </ul>
  </div>
{/if}

{#if shortcutsOpen}
  <dialog bind:this={shortcutDialog} class="shortcuts-dialog" aria-label="Keyboard shortcuts" on:close={() => { shortcutsOpen = false; editor?.focusEditor() }}>
    <div class="dialog-header"><h2>Keyboard shortcuts</h2><button class="icon-button" aria-label="Close keyboard shortcuts" on:click={closeShortcuts}>×</button></div>
    {#if shortcutList.length === 0}
      <p>Loading shortcuts…</p>
    {:else}
      {#each ['File', 'View', 'Find', 'Editing', 'Formatting', 'Structure', 'Help'] as group}
        <section class="shortcut-group">
          <h3>{group}</h3>
          {#each shortcutList.filter(item => item.group === group) as shortcut (shortcut.id)}
            <div class="shortcut-row"><span>{shortcut.label}</span><kbd>{macKeyboard ? shortcut.mac : shortcut.other}</kbd></div>
          {/each}
        </section>
      {/each}
    {/if}
  </dialog>
{/if}
