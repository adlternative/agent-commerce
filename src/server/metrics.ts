/**
 * In-process HTTP metrics for GET /metrics (Prometheus text exposition, no deps).
 */

export type MetricLabels = {
  method: string
  path: string
  status: string
}

type CounterKey = string

function keyOf(labels: MetricLabels): CounterKey {
  return `${labels.method}|${labels.path}|${labels.status}`
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

export type MetricsSnapshot = {
  requestsTotal: Array<MetricLabels & { value: number }>
  durationCount: Array<{ method: string; path: string; value: number }>
  durationSumMs: Array<{ method: string; path: string; value: number }>
}

export class HttpMetrics {
  private readonly requests = new Map<CounterKey, { labels: MetricLabels; value: number }>()
  private readonly durationCount = new Map<string, { method: string; path: string; value: number }>()
  private readonly durationSumMs = new Map<string, { method: string; path: string; value: number }>()

  record(method: string, path: string, status: number, durationMs: number): void {
    const labels: MetricLabels = {
      method: method.toUpperCase(),
      path,
      status: String(status),
    }
    const ck = keyOf(labels)
    const existing = this.requests.get(ck)
    if (existing) {
      existing.value += 1
    } else {
      this.requests.set(ck, { labels, value: 1 })
    }

    const dk = `${labels.method}|${labels.path}`
    const count = this.durationCount.get(dk)
    if (count) {
      count.value += 1
    } else {
      this.durationCount.set(dk, { method: labels.method, path: labels.path, value: 1 })
    }
    const sum = this.durationSumMs.get(dk)
    if (sum) {
      sum.value += durationMs
    } else {
      this.durationSumMs.set(dk, { method: labels.method, path: labels.path, value: durationMs })
    }
  }

  snapshot(): MetricsSnapshot {
    return {
      requestsTotal: [...this.requests.values()].map((e) => ({ ...e.labels, value: e.value })),
      durationCount: [...this.durationCount.values()].map((e) => ({ ...e })),
      durationSumMs: [...this.durationSumMs.values()].map((e) => ({ ...e })),
    }
  }

  reset(): void {
    this.requests.clear()
    this.durationCount.clear()
    this.durationSumMs.clear()
  }

  /** Prometheus text exposition format (0.0.4). */
  renderPrometheus(): string {
    const lines: string[] = []
    lines.push('# HELP http_requests_total Total HTTP requests handled')
    lines.push('# TYPE http_requests_total counter')
    for (const entry of this.requests.values()) {
      const { method, path, status } = entry.labels
      lines.push(
        `http_requests_total{method="${escapeLabel(method)}",path="${escapeLabel(path)}",status="${escapeLabel(status)}"} ${entry.value}`,
      )
    }

    lines.push('# HELP http_request_duration_ms_sum Cumulative request duration in milliseconds')
    lines.push('# TYPE http_request_duration_ms_sum counter')
    for (const entry of this.durationSumMs.values()) {
      lines.push(
        `http_request_duration_ms_sum{method="${escapeLabel(entry.method)}",path="${escapeLabel(entry.path)}"} ${entry.value}`,
      )
    }

    lines.push('# HELP http_request_duration_ms_count Request duration sample count')
    lines.push('# TYPE http_request_duration_ms_count counter')
    for (const entry of this.durationCount.values()) {
      lines.push(
        `http_request_duration_ms_count{method="${escapeLabel(entry.method)}",path="${escapeLabel(entry.path)}"} ${entry.value}`,
      )
    }

    lines.push('')
    return lines.join('\n')
  }
}
