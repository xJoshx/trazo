export interface BuildMetrics {
  generatedAt: string
  rawBytes: number
  gzipBytes: number
  files: { path: string; rawBytes: number; gzipBytes: number }[]
}

export interface MetricsSnapshot {
  ttsMs?: number
  ttiMs?: number
  ttfbMs?: number
  lcpMs?: number
  cls?: number
  inpMs?: number
  fps?: number
  slowFrames: number
  inputP95Ms?: number
  analysisP95Ms?: number
  saveP95Ms?: number
  longTasks: number
  heapBytes?: number
  visible: boolean
}

function p95(samples: number[]): number | undefined {
  if (!samples.length) return undefined
  const ordered = [...samples].sort((a, b) => a - b)
  return ordered[Math.ceil(ordered.length * .95) - 1]
}

function remember(samples: number[], value: number): void {
  samples.push(value)
  if (samples.length > 100) samples.shift()
}

export class LiveMetrics {
  onUpdate: (value: MetricsSnapshot) => void = () => {}
  private observers: PerformanceObserver[] = []
  private inputSamples: number[] = []
  private analysisSamples: number[] = []
  private saveSamples: number[] = []
  private interactions = new Map<number, number>()
  private ttsMs?: number
  private ttiMs?: number
  private ttfbMs?: number
  private lcpMs?: number
  private cls = 0
  private fps?: number
  private slowFrames = 0
  private longTasks = 0
  private frameId = 0
  private frameTimes: number[] = []
  private lastFrame = 0
  private timer = 0
  private opened = false
  private visibilityChanged = () => {
    this.lastFrame = 0
    this.frameTimes = []
    if (document.visibilityState !== 'visible') this.fps = undefined
    this.emit()
  }

  start(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navigation?.responseStart) this.ttfbMs = navigation.responseStart - navigation.requestStart
    for (const entry of performance.getEntriesByType('paint')) {
      if (entry.name === 'first-contentful-paint') this.ttsMs = entry.startTime
    }
    this.observe('paint', entry => {
      if (entry.name === 'first-contentful-paint') this.ttsMs = entry.startTime
    })
    this.observe('largest-contentful-paint', entry => { this.lcpMs = entry.startTime })
    this.observe('layout-shift', entry => {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
      if (!shift.hadRecentInput) this.cls += shift.value
    })
    this.observe('event', entry => {
      const event = entry as PerformanceEntry & { interactionId?: number; duration: number }
      if (event.interactionId) this.interactions.set(event.interactionId, Math.max(event.duration, this.interactions.get(event.interactionId) ?? 0))
    })
    this.observe('longtask', () => { this.longTasks++ })
  }

  private observe(type: string, visit: (entry: PerformanceEntry) => void): void {
    if (!('PerformanceObserver' in window) || !PerformanceObserver.supportedEntryTypes.includes(type)) return
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) visit(entry)
        if (this.opened) this.emit()
      })
      observer.observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) } as PerformanceObserverInit)
      this.observers.push(observer)
    } catch { /* This browser does not expose this entry type. */ }
  }

  markScreen(): void { if (this.ttsMs === undefined) this.ttsMs = performance.now() }
  markInteractive(): void { this.ttiMs = performance.now() }
  recordInput(): void {
    const start = performance.now()
    requestAnimationFrame(() => {
      if (document.visibilityState === 'visible') remember(this.inputSamples, performance.now() - start)
    })
  }
  recordAnalysis(duration: number): void { remember(this.analysisSamples, duration) }
  recordSave(duration: number): void { remember(this.saveSamples, duration) }

  snapshot(): MetricsSnapshot {
    const durations = [...this.interactions.values()].sort((a, b) => b - a)
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } }
    return {
      ttsMs: this.ttsMs,
      ttiMs: this.ttiMs === undefined ? undefined : Math.max(this.ttiMs, this.ttsMs ?? 0),
      ttfbMs: this.ttfbMs,
      lcpMs: this.lcpMs,
      cls: this.cls,
      inpMs: durations[Math.floor(durations.length / 50)],
      fps: this.fps,
      slowFrames: this.slowFrames,
      inputP95Ms: p95(this.inputSamples),
      analysisP95Ms: p95(this.analysisSamples),
      saveP95Ms: p95(this.saveSamples),
      longTasks: this.longTasks,
      heapBytes: memory.memory?.usedJSHeapSize,
      visible: document.visibilityState === 'visible'
    }
  }

  open(): void {
    if (this.opened) return
    this.opened = true
    document.addEventListener('visibilitychange', this.visibilityChanged)
    this.frameTimes = []
    this.lastFrame = 0
    const frame = (now: number) => {
      if (!this.opened) return
      if (document.visibilityState === 'visible') {
        if (this.lastFrame && now - this.lastFrame > 50) this.slowFrames++
        this.lastFrame = now
        this.frameTimes.push(now)
        while (this.frameTimes.length && this.frameTimes[0] < now - 1000) this.frameTimes.shift()
        if (this.frameTimes.length > 1) {
          const span = now - this.frameTimes[0]
          if (span > 0) this.fps = Math.round((this.frameTimes.length - 1) * 1000 / span)
        }
      } else {
        this.fps = undefined
        this.lastFrame = 0
        this.frameTimes = []
      }
      this.frameId = requestAnimationFrame(frame)
    }
    this.frameId = requestAnimationFrame(frame)
    this.timer = window.setInterval(() => this.emit(), 1000)
    this.emit()
  }

  close(): void {
    this.opened = false
    document.removeEventListener('visibilitychange', this.visibilityChanged)
    cancelAnimationFrame(this.frameId)
    clearInterval(this.timer)
    this.fps = undefined
  }

  private emit(): void { this.onUpdate(this.snapshot()) }
  destroy(): void { this.close(); for (const observer of this.observers) observer.disconnect() }
}
