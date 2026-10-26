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

  list(limit = 50): AuditEvent[] {
    return this.events.slice(-limit)
  }

  clear(): void {
    this.events = []
    this.seq = 0
  }
}
