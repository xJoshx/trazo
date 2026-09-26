<script lang="ts">
  import type { BuildMetrics, MetricsSnapshot } from './metrics'

  export let snapshot: MetricsSnapshot
  export let build: BuildMetrics | null
  export let onClose: () => void

  function ms(value: number | undefined): string { return value === undefined ? '—' : `${Math.round(value)} ms` }
  function bytes(value: number | undefined): string {
    if (value === undefined) return '—'
    return value >= 1_048_576 ? `${(value / 1_048_576).toFixed(2)} MiB` : `${Math.round(value / 1024)} KiB`
  }
  function category(path: string): string {
    if (path.endsWith('.js')) return 'JavaScript'
    if (path.endsWith('.css')) return 'CSS'
    if (path.endsWith('.wasm')) return 'WebAssembly'
    if (path.endsWith('.woff2')) return 'Fonts'
    if (/\.(png|svg|ico)$/.test(path)) return 'Images'
    return 'Other'
  }
  $: groups = build ? Object.entries(build.files.reduce<Record<string, { raw: number; gzip: number }>>((result, file) => {
    const name = category(file.path)
    result[name] ??= { raw: 0, gzip: 0 }
    result[name].raw += file.rawBytes
    result[name].gzip += file.gzipBytes
    return result
  }, {})).sort((a, b) => b[1].raw - a[1].raw) : []
</script>

<aside class="metrics-panel" aria-label="Performance metrics">
  <div class="metrics-header">
    <div><strong>Performance</strong><span class="metrics-live">Live · local only</span></div>
    <button class="metrics-close" aria-label="Close metrics" on:click={onClose}>×</button>
  </div>

  <div class="metrics-scroll">
    <section aria-label="Live writing metrics">
      <h2>While writing</h2>
      <div class="metrics-grid">
        <div class="metric"><span>Frame rate</span><strong>{snapshot.visible && snapshot.fps !== undefined ? `${snapshot.fps} fps` : 'Paused'}</strong><small>Sampled while this panel is open</small></div>
        <div class="metric"><span>Edit → frame</span><strong>{ms(snapshot.inputP95Ms)}</strong><small>p95, last 100 edits</small></div>
        <div class="metric"><span>Analysis</span><strong>{ms(snapshot.analysisP95Ms)}</strong><small>p95, last 100 worker runs</small></div>
        <div class="metric"><span>Local save</span><strong>{ms(snapshot.saveP95Ms)}</strong><small>p95, last 100 commits</small></div>
        <div class="metric"><span>Slow frames</span><strong>{snapshot.slowFrames}</strong><small>Over 50 ms, panel open</small></div>
        <div class="metric"><span>Long tasks</span><strong>{snapshot.longTasks}</strong><small>Over 50 ms, since load</small></div>
        <div class="metric"><span>JS heap</span><strong>{bytes(snapshot.heapBytes)}</strong><small>Browser support varies</small></div>
      </div>
    </section>

    <section aria-label="Startup metrics">
      <h2>Startup &amp; web vitals</h2>
      <div class="metrics-grid">
        <div class="metric"><span>TTS · screen</span><strong>{ms(snapshot.ttsMs)}</strong><small>First contentful paint / app frame</small></div>
        <div class="metric"><span>TTI · editor</span><strong>{ms(snapshot.ttiMs)}</strong><small>Editor ready for input</small></div>
        <div class="metric"><span>TTFB</span><strong>{ms(snapshot.ttfbMs)}</strong><small>Navigation response start</small></div>
        <div class="metric"><span>LCP</span><strong>{ms(snapshot.lcpMs)}</strong><small>Largest contentful paint</small></div>
        <div class="metric"><span>CLS</span><strong>{snapshot.cls === undefined ? '—' : snapshot.cls.toFixed(3)}</strong><small>Layout shift since load</small></div>
        <div class="metric"><span>INP estimate</span><strong>{ms(snapshot.inpMs)}</strong><small>Event Timing, if supported</small></div>
      </div>
      <p class="metrics-note">TTI and INP here are local estimates. Cached loads, background tabs, and browser support can change the readings.</p>
    </section>

    <section aria-label="Build size">
      <h2>Build assets</h2>
      {#if build}
        <div class="metrics-grid">
          <div class="metric"><span>Raw</span><strong>{bytes(build.rawBytes)}</strong><small>{build.files.length} app files</small></div>
          <div class="metric"><span>Gzip</span><strong>{bytes(build.gzipBytes)}</strong><small>Estimated transfer size</small></div>
        </div>
        <table class="metrics-table">
          <thead><tr><th>Type</th><th>Raw</th><th>Gzip</th></tr></thead>
          <tbody>{#each groups as [name, size]}<tr><td>{name}</td><td>{bytes(size.raw)}</td><td>{bytes(size.gzip)}</td></tr>{/each}</tbody>
        </table>
        <details class="metrics-files"><summary>Individual files</summary><table class="metrics-table"><tbody>{#each build.files as file}<tr><td title={file.path}>{file.path}</td><td>{bytes(file.rawBytes)}</td><td>{bytes(file.gzipBytes)}</td></tr>{/each}</tbody></table></details>
        <p class="metrics-note">Compiled JS/CSS/WASM plus fonts and icons. HTML, manifest, service worker, and HTTP overhead are excluded.</p>
      {:else}
        <p class="metrics-note">Build sizes appear in a production build. Run <code>npm run build</code> and open the preview.</p>
      {/if}
    </section>
  </div>
</aside>
