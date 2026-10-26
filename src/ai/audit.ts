export type AuditEvent = {
  id: string
  at: string
  actor: string
  role: string
  method: string
  path: string
  status: number
  idempotencyKey?: string
  code?: string
  durationMs: number
  /** Present when the event was recorded from an HTTP request with a trace id. */
  traceId?: string
}

export type AuditQuery = {
  /** Max events to return (newest first within the filtered set). Default 50, max 500. */
  limit?: number
  actor?: string
  role?: string
  method?: string
  /** Path must start with this prefix (e.g. `/api/merchant`). */
  pathPrefix?: string
  /** Substring match on path (case-sensitive). */
  pathContains?: string
  status?: number
  code?: string
  traceId?: string
  /** Inclusive lower bound (ISO-8601). */
  since?: string
  /** Inclusive upper bound (ISO-8601). */
  until?: string
}

/** In-memory ring buffer audit log for AI/agent observability. */
export class AuditLog {
  private events: AuditEvent[] = []
  private seq = 0

  constructor(private readonly max = 1000) {}

  record(partial: Omit<AuditEvent, 'id' | 'at'> & { at?: string }): AuditEvent {
    this.seq += 1
    const event: AuditEvent = {
      id: `aud_${this.seq}`,
      at: partial.at ?? new Date().toISOString(),
      actor: partial.actor,
      role: partial.role,
      method: partial.method,
      path: partial.path,
      status: partial.status,
      idempotencyKey: partial.idempotencyKey,
      code: partial.code,
      durationMs: partial.durationMs,
      traceId: partial.traceId,
    }
    this.events.push(event)
    if (this.events.length > this.max) {
      this.events = this.events.slice(-this.max)
    }
    return event
  }

  /** Recent events (oldest → newest within the window). */
  list(limit = 50): AuditEvent[] {
    return this.query({ limit })
  }

  /**
   * Filter audit events. Matching is AND across provided fields.
   * Returns oldest → newest within the selected window (same as `list`).
   */
  query(q: AuditQuery = {}): AuditEvent[] {
    const limitRaw = q.limit ?? 50
    const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50))

    const sinceMs = q.since ? Date.parse(q.since) : Number.NaN
    const untilMs = q.until ? Date.parse(q.until) : Number.NaN

    const filtered = this.events.filter((e) => {
      if (q.actor !== undefined && e.actor !== q.actor) return false
      if (q.role !== undefined && e.role !== q.role) return false
      if (q.method !== undefined && e.method.toUpperCase() !== q.method.toUpperCase()) return false
      if (q.pathPrefix !== undefined && !e.path.startsWith(q.pathPrefix)) return false
      if (q.pathContains !== undefined && !e.path.includes(q.pathContains)) return false
      if (q.status !== undefined && e.status !== q.status) return false
      if (q.code !== undefined && e.code !== q.code) return false
      if (q.traceId !== undefined && e.traceId !== q.traceId) return false
      if (!Number.isNaN(sinceMs)) {
        const at = Date.parse(e.at)
        if (Number.isNaN(at) || at < sinceMs) return false
      }
      if (!Number.isNaN(untilMs)) {
        const at = Date.parse(e.at)
        if (Number.isNaN(at) || at > untilMs) return false
      }
      return true
    })

    return filtered.slice(-limit)
  }

  clear(): void {
    this.events = []
    this.seq = 0
  }
}
