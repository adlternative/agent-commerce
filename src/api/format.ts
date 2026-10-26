/** Display helper only — never use floats for money math. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const yuan = Math.floor(abs / 100)
  const fen = abs % 100
  return `${sign}¥${yuan}.${fen.toString().padStart(2, '0')}`
}
