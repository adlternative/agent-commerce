import type { CommerceService } from '../services/commerce.js'

/** Demo catalog so the customer UI works out of the box. */
export async function seedDemoCatalog(commerce: CommerceService): Promise<void> {
  const existing = await commerce.listProducts()
  if (existing.length > 0) return

  const mug = await commerce.upsertProduct(
    {
      sku: 'MUG-01',
      name: 'Agent Mug',
      description: 'Matte ceramic mug for long agent sessions.',
      priceCents: 2_500,
      tags: ['kitchen', 'merch'],
      agentNotes: 'Ceramic mug; agents should buy qty 1–4. Pairs with SAVE200.',
    },
    'seed-demo-mug',
  )
  await commerce.adjustStock(mug.id, 50, 'seed-demo-mug-stock')

  const tee = await commerce.upsertProduct(
    {
      sku: 'TEE-BLK-M',
      name: 'Black Tee M',
      description: 'Midweight black tee, size M.',
      priceCents: 3_900,
      tags: ['apparel'],
      agentNotes: 'Best for agents that need a simple apparel SKU.',
    },
    'seed-demo-tee',
  )
  await commerce.adjustStock(tee.id, 40, 'seed-demo-tee-stock')

  await commerce.upsertPromotion(
    {
      code: 'SAVE200',
      type: 'coupon_fixed',
      offCents: 200,
      active: true,
    },
    'seed-demo-promo',
  )
}
