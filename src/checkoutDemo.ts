import type { CheckoutLine, CheckoutTotals } from './components/CheckoutPage'

/** Demo cart for the checkout page (Task 5). Independent of cart/pricing modules. */
export const DEMO_CHECKOUT_LINES: CheckoutLine[] = [
  { sku: 'AC-NOTE-01', name: 'Agent 记事本（方格）', qty: 2, unitPriceFen: 2900 },
  { sku: 'AC-USB-C', name: 'USB-C 扩展坞', qty: 1, unitPriceFen: 19900 },
  { sku: 'AC-CABLE', name: '编织充电线 2m', qty: 1, unitPriceFen: 4900 },
]

export function demoCheckoutTotals(lines: CheckoutLine[]): CheckoutTotals {
  const subtotalFen = lines.reduce((sum, l) => sum + l.unitPriceFen * l.qty, 0)
  const discountFen = subtotalFen >= 20000 ? 2000 : 0
  const afterDiscount = subtotalFen - discountFen
  const shippingFen = afterDiscount >= 9900 ? 0 : 800
  return {
    subtotalFen,
    discountFen,
    shippingFen,
    totalFen: afterDiscount + shippingFen,
  }
}
