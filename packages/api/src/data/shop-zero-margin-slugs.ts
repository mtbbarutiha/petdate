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

export const SHOP_BATCH_MULTI_WAVE2_SLUGS = [
  'dog-treats-wanpy-chicken-jerky-chips-100g',
  'cat-treats-bioline-catnip-spray-50ml',
  'cat-treats-bonnest-catnip-spray-50-l',
  'cat-treats-cat-grass-theething-stick-30-g',
  'cat-treats-bonnest-cat-nip-powder-20g-20-g',
  'cat-treats-chicken-cat-grass-treat-30-g',
  'dog-toys-enjoy-the-meal-puzzle-toy',
  'dog-toys-ufo-treat-dispenser-dog-toy',
  'dog-toys-crab-silicone-dog-chew-toothbrush-toy',
  'dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy',
] as const;

export const SHOP_BATCH_MULTI_WAVE3_SLUGS = [
  'dog-toys-luna-pomegranate-felt-squeaky-dog-toy',
  'dog-toys-luna-squeaky-watermelon-plush-dog-toy',
  'cat-toys-petopoli-4-way-foldable-cat-play-tunnel',
  'cat-toys-cat-toy-layer-tower-of-tracks',
  'cat-toys-hanging-catnip-bat-toy-for-cats',
  'cat-toys-little-yellow-cat-toy',
  'cat-toys-play-tunnel-bag',
  'cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats',
  'dog-accessories-hannapet-silicone-h-harness-size-l',
  'dog-accessories-hannapet-silicone-dog-leash-size-l',
] as const;

export const SHOP_BATCH_MULTI_WAVE4_SLUGS = [
  'dog-accessories-hannapet-silicone-h-harness-sizr-m',
  'dog-accessories-waudog-classic-leather-collar-25-mm',
  'dog-accessories-hannapet-silicone-dog-leash-size-m',
  'cat-accessories-hannapet-double-wooden-bowl-stand',
  'cat-accessories-eggshell-bowls-for-cats',
  'cat-accessories-high-legend-bowls-for-cat',
  'cat-accessories-hanapet-double-metal-bowl-stand',
  'cat-accessories-petopoli-four-legged-pet-bowl',
  'grooming-mojan-pet-brush',
  'grooming-dog-shedding-brush-hair-release-button',
] as const;

export const ZERO_MARGIN_SHOP_SLUGS: readonly string[] = [
  ...ROYAL_CANIN_PILOT_SLUGS,
  ...SHOP_BATCH2_SLUGS,
  ...SHOP_BATCH3_SLUGS,
  ...SHOP_BATCH_MULTI_SLUGS,
  ...SHOP_BATCH_MULTI_WAVE2_SLUGS,
  ...SHOP_BATCH_MULTI_WAVE3_SLUGS,
  ...SHOP_BATCH_MULTI_WAVE4_SLUGS,
];

/** Live shop product ids — 3 pilots + 12 Batch 2 + 14 Batch 3 + 10 multi wave 1 + 10 multi wave 2 + 10 multi wave 3 + 10 multi wave 4. Never purge these rows. */
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
  'p260',
  'p261',
  'p262',
  'p263',
  'p264',
  'p265',
  'p266',
  'p267',
  'p268',
  'p269',
  'p270',
  'p271',
  'p272',
  'p273',
  'p274',
  'p275',
  'p276',
  'p277',
  'p278',
  'p279',
  'p280',
  'p281',
  'p282',
  'p283',
  'p284',
  'p285',
  'p286',
  'p287',
  'p288',
  'p289',
] as const;

export function isLiveShopProductIdOrSlug(idOrSlug: string): boolean {
  const key = String(idOrSlug || '').trim();
  return (
    (LIVE_SHOP_PRODUCT_IDS as readonly string[]).includes(key) ||
    ZERO_MARGIN_SHOP_SLUGS.includes(key)
  );
}

export const HELD_SHOP_SLUGS = [] as const;
