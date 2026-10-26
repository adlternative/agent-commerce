import type { IncomingMessage } from 'node:http'
import { DomainError } from '../domain/errors.js'

export type Role = 'customer' | 'merchant' | 'agent'

export type Actor = {
  role: Role
  subject: string
}

export type AuthConfig = {
  /** Map bearer token → actor */
  tokens: Record<string, Actor>
}

export const DEFAULT_AUTH: AuthConfig = {
  tokens: {
    'customer-token': { role: 'customer', subject: 'cust_demo' },
    'merchant-token': { role: 'merchant', subject: 'merchant_demo' },
    'agent-token': { role: 'agent', subject: 'agent_demo' },
  },
}

export function authenticate(req: IncomingMessage, config: AuthConfig = DEFAULT_AUTH): Actor {
  const header = req.headers.authorization
  if (!header) {
    throw new DomainError('UNAUTHORIZED', 'missing Authorization header', {
      hint: 'use Authorization: Bearer <token>',
      retryable: false,
    })
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match?.[1]) {
    throw new DomainError('UNAUTHORIZED', 'invalid Authorization header', {
      hint: 'expected Bearer token',
      retryable: false,
    })
  }
  const actor = config.tokens[match[1]]
  if (!actor) {
    throw new DomainError('UNAUTHORIZED', 'unknown or revoked token', {
      retryable: false,
    })
  }
  return actor
}

export function requireRole(actor: Actor, allowed: Role[]): void {
  if (!allowed.includes(actor.role)) {
    throw new DomainError('FORBIDDEN', `role ${actor.role} cannot access this route`, {
      hint: `allowed: ${allowed.join(', ')}`,
      retryable: false,
    })
  }
}
