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

export const SHOP_BATCH3_SLUGS = [
  'cat-food-royal-canin-sensible-2kg',
  'cat-food-josera-marinesse-2kg',
  'cat-food-josera-sensicat-2kg',
  'cat-food-royal-canin-mother-babycat-2kg',
  'cat-food-royal-canin-dental-1-5kg',
  'cat-food-royal-canin-light-weight-1-5kg',
  'cat-food-royal-canin-hairball-2kg',
  'cat-food-royal-canin-hair-skin-2kg',
  'cat-food-royal-canin-urinary-so-1-5kg',
  'dog-food-royal-canin-mini-sterilised-3kg',
  'dog-food-royal-canin-mini-light-weight-3kg',
  'dog-food-royal-canin-poodle-adult-3kg',
  'dog-food-royal-canin-poodle-puppy-3kg',
  'dog-food-royal-canin-hypoallergenic-2kg',
] as const;

export const SHOP_BATCH_MULTI_SLUGS = [
  'cat-litter-mr-cat-cat-litter-10-l-carbon',
  'cat-litter-mr-cat-baby-powder-scented-cat-litter-10l-10-kg',
  'cat-litter-meocat-activated-carbon-cat-litter-economy',
  'cat-litter-mr-cat-oxygen-cat-litter-10-l-10-kg',
  'cat-litter-meocat-super-clump-cat-litter-economy',
  'cat-litter-mr-cat-kitten-cat-litter-7l-7-kg',
  'dog-treats-afp-chill-out-ice-bone',
  'dog-treats-dr-clauders-pork-filet-strips-80-g',
  'dog-treats-rabbit-fillet-dr-clauders-80-g',
  'dog-treats-wanpy-toothbrush-chews-100g',
] as const;

export const ZERO_MARGIN_SHOP_SLUGS: readonly string[] = [
  ...ROYAL_CANIN_PILOT_SLUGS,
  ...SHOP_BATCH2_SLUGS,
  ...SHOP_BATCH3_SLUGS,
  ...SHOP_BATCH_MULTI_SLUGS,
];

/** Live shop product ids — 3 pilots + 12 Batch 2 + 14 Batch 3 + 10 Batch-multi wave 1. Never purge these rows. */
export const LIVE_SHOP_PRODUCT_IDS = [
  'p221',
  'p222',
  'p223',
  'p224',
  'p225',
  'p226',
  'p227',
  'p228',
  'p229',
  'p230',
  'p231',
  'p232',
  'p233',
  'p234',
  'p235',
  'p236',
  'p237',
  'p238',
  'p239',
  'p240',
  'p241',
  'p242',
  'p243',
  'p244',
  'p245',
  'p246',
  'p247',
  'p248',
  'p249',
  'p250',
  'p251',
  'p252',
  'p253',
  'p254',
  'p255',
  'p256',
  'p257',
  'p258',
  'p259',
] as const;

export function isLiveShopProductIdOrSlug(idOrSlug: string): boolean {
  const key = String(idOrSlug || '').trim();
  return (
    (LIVE_SHOP_PRODUCT_IDS as readonly string[]).includes(key) ||
    ZERO_MARGIN_SHOP_SLUGS.includes(key)
  );
}

export const HELD_SHOP_SLUGS = [] as const;
