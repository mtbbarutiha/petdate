/** Live shop SKUs priced at margin 0 (cost_toman = price_toman). */
export const ROYAL_CANIN_PILOT_SLUGS = [
  'dog-food-royal-canin-mini-adult-2kg',
  'dog-food-royal-canin-xsmall-puppy-1-5kg',
  'cat-food-royal-canin-persian-adult-400g',
] as const;

export const SHOP_BATCH2_SLUGS = [
  'dog-food-royal-canin-mini-indoor-puppy-1-5kg',
  'dog-food-royal-canin-xsmall-adult-1-5kg',
  'dog-food-royal-canin-mini-puppy-2kg',
  'dog-food-royal-canin-pomeranian-adult-1-5kg',
  'dog-food-royal-canin-shih-tzu-adult-1-5kg',
  'cat-food-josera-culinesse-2kg',
  'cat-food-josera-dailycat-2kg',
  'cat-food-royal-canin-indoor-adult-400g',
  'cat-food-royal-canin-british-shorthair-adult-400g',
  'cat-food-royal-canin-fit-2kg',
  'cat-food-royal-canin-sterilised-adult-400g',
  'cat-food-josera-kitten-2kg',
] as const;

export const ZERO_MARGIN_SHOP_SLUGS: readonly string[] = [
  ...ROYAL_CANIN_PILOT_SLUGS,
  ...SHOP_BATCH2_SLUGS,
];

export const HELD_SHOP_SLUGS = [] as const;
