export interface Span { start: number; end: number; kind: string }
export interface Analysis {
  spans: Span[]
  paragraphs: Span[]
  tags: Span[]
  word_count: number
  preview_html: string | null
}
export type AnalysisResult = { type: 'result'; documentId: string; revision: number; analysis: Analysis; durationMs: number }

type AnalyzeMessage = { type: 'analyze'; documentId: string; revision: number; text: string; previewRequested: boolean }
type WorkerMessage =
  | { type: 'result'; documentId: string; revision: number; analysis: Analysis }
  | { type: 'error'; message: string }

export class Analyzer {
  private worker: Worker | null = null
  private inFlight = false
  private pending: AnalyzeMessage | null = null
  private sentAt = 0
  onResult: (message: AnalysisResult) => void = () => {}
  onError: (message: string) => void = () => {}

  constructor() { this.restart() }

  restart(): void {
    this.worker?.terminate()
    this.inFlight = false
    this.pending = null
    this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === 'result') {
        this.inFlight = false
        this.onResult({ ...event.data, durationMs: performance.now() - this.sentAt })
        this.flush()
      } else {
        this.inFlight = false
        this.onError(event.data.message)
      }
    }
    this.worker.onerror = (event) => {
      this.inFlight = false
      this.onError(event.message || 'Preview worker failed.')
    }
  }

  analyze(message: Omit<AnalyzeMessage, 'type'>): void {
    this.pending = { type: 'analyze', ...message }
    this.flush()
  }

  private flush(): void {
    if (!this.inFlight && this.pending && this.worker) {
      this.inFlight = true
      this.sentAt = performance.now()
      this.worker.postMessage(this.pending)
      this.pending = null
    }
  }

  destroy(): void { this.worker?.terminate(); this.worker = null }
}
