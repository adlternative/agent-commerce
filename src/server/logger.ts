import { randomUUID } from 'node:crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

export type Logger = {
  child(fields: LogFields): Logger
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
}

export type LogSink = (line: string) => void

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function defaultSink(line: string): void {
  // Structured logs always go to stdout as a single JSON line.
  process.stdout.write(`${line}\n`)
}

/**
 * Resolve an inbound trace id from `x-trace-id` or W3C `traceparent`,
 * or mint a new opaque id when neither is present.
 */
export function resolveTraceId(
  xTraceId: string | string[] | undefined,
  traceparent?: string | string[] | undefined,
): string {
  const fromHeader = firstHeader(xTraceId)?.trim()
  if (fromHeader && /^[A-Za-z0-9._-]{8,128}$/.test(fromHeader)) {
    return fromHeader
  }
  const tp = firstHeader(traceparent)?.trim()
  if (tp) {
    // version-traceId-spanId-flags
    const parts = tp.split('-')
    if (parts.length >= 3 && /^[0-9a-f]{32}$/i.test(parts[1]!)) {
      return parts[1]!.toLowerCase()
    }
  }
  return randomUUID().replace(/-/g, '')
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/** Create a structured JSON logger. Child loggers inherit and merge fields (e.g. traceId). */
export function createLogger(
  base: LogFields = {},
  opts: { sink?: LogSink; minLevel?: LogLevel } = {},
): Logger {
  const sink = opts.sink ?? defaultSink
  const minLevel = opts.minLevel ?? 'info'

  const emit = (level: LogLevel, msg: string, fields?: LogFields): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...base,
      ...fields,
    }
    sink(JSON.stringify(entry))
  }

  return {
    child(fields: LogFields): Logger {
      return createLogger({ ...base, ...fields }, opts)
    },
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  }
}
