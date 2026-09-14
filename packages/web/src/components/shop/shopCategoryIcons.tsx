import type { ReactElement } from 'react';

/** Illustrated shop category tiles — not Lucide outlines. */
export type ShopCategoryArtKind =
  | 'food'
  | 'treats'
  | 'groom'
  | 'toys'
  | 'bowls'
  | 'travel'
  | 'collars'
  | 'clothes'
  | 'shield'
  | 'beds'
  | 'trees'
  | 'litter'
  | 'bird'
  | 'rodent'
  | 'more';

const BY_SLUG: Record<string, ShopCategoryArtKind> = {
  'dog-food': 'food',
  'dog-treats': 'treats',
  'dog-grooming': 'groom',
  'dog-toys': 'toys',
  'dog-bowls': 'bowls',
  'dog-carriers-travel': 'travel',
  'dog-carriers': 'travel',
  'dog-collars': 'collars',
  'dog-accessories': 'collars',
  grooming: 'groom',
  'dog-clothing': 'clothes',
  'dog-flea-tick': 'shield',
  'dog-beds': 'beds',
  'cat-food': 'food',
  'cat-treats': 'treats',
  'cat-grooming': 'groom',
  'cat-toys': 'toys',
  'cat-trees': 'trees',
  'cat-bowls': 'bowls',
  'cat-accessories': 'bowls',
  'cat-litter': 'litter',
  'cat-carriers-travel': 'travel',
  'cat-carriers': 'travel',
  'cat-beds': 'beds',
  'cat-flea-tick': 'shield',
  'bird-food': 'bird',
  'bird-accessories': 'bird',
  'rodent-supplies': 'rodent',
};

export function shopCategoryArtKind(slug: string): ShopCategoryArtKind {
  return BY_SLUG[slug] ?? 'more';
}

type ArtProps = { kind: ShopCategoryArtKind };

function ArtFood() {
  return (
    <>
      <ellipse cx="44" cy="72" rx="26" ry="5" fill="rgba(25,6,61,0.08)" />
      <rect x="18" y="14" width="36" height="44" rx="8" fill="#7b63c7" />
      <rect x="18" y="14" width="36" height="14" rx="8" fill="#5c4d91" />
      <rect x="18" y="22" width="36" height="8" fill="#5c4d91" />
      <path d="M26 20h20" stroke="#f4e9a8" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="36" cy="38" r="7" fill="#f4e9a8" />
      <path d="M36 33v10M31 38h10" stroke="#5c4d91" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="58" cy="58" rx="18" ry="8" fill="#e8c07a" />
      <ellipse cx="58" cy="55" rx="14" ry="5.5" fill="#f3d7a0" />
      <circle cx="52" cy="55" r="2.1" fill="#c48a3a" />
      <circle cx="59" cy="57" r="1.8" fill="#c48a3a" />
      <circle cx="64" cy="54" r="1.6" fill="#c48a3a" />
    </>
  );
}

function ArtTreats() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="24" ry="5" fill="rgba(25,6,61,0.08)" />
      <path
        d="M22 40c0-7 6-12 12-12 3 0 5 1 8 4 3-3 5-4 8-4 6 0 12 5 12 12 0 14-12 28-20 34-8-6-20-20-20-34z"
        fill="#e89a4a"
      />
      <path
        d="M28 40c0-4.2 3.4-7.2 7.2-7.2 2.2 0 4 1 6.8 3.8 2.8-2.8 4.6-3.8 6.8-3.8 3.8 0 7.2 3 7.2 7.2 0 10-8.5 21-14 26-5.5-5-14-16-14-26z"
        fill="#f3b56a"
      />
      <circle cx="40" cy="42" r="2" fill="#d47b28" />
      <circle cx="50" cy="38" r="1.6" fill="#d47b28" />
      <circle cx="46" cy="50" r="1.8" fill="#d47b28" />
    </>
  );
}

function ArtGroom() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <rect x="30" y="12" width="20" height="10" rx="4" fill="#49c4d9" />
      <rect x="26" y="20" width="28" height="42" rx="10" fill="#2aa0b8" />
      <rect x="30" y="26" width="20" height="28" rx="8" fill="#7ad7ea" />
      <path d="M40 32c6 4 6 14 0 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="54" y="34" width="10" height="28" rx="3" fill="#f4d2a8" />
      <path d="M56 34h6v-8c0-4-6-4-6 0v8z" fill="#d9b48c" />
      <path d="M55 22h8M55 18h8M55 14h8" stroke="#c48a3a" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function ArtToys() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <circle cx="40" cy="44" r="22" fill="#c8e86a" />
      <path d="M22 36c8 4 20 4 32 0" stroke="#fff" strokeWidth="5" fill="none" />
      <path d="M22 52c8-4 20-4 32 0" stroke="#fff" strokeWidth="5" fill="none" />
      <circle cx="40" cy="44" r="22" fill="none" stroke="#7aa31a" strokeWidth="2" />
      <circle cx="64" cy="28" r="10" fill="#db89ca" />
      <circle cx="64" cy="28" r="4" fill="#fff" opacity="0.45" />
    </>
  );
}

function ArtBowls() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="24" ry="5" fill="rgba(25,6,61,0.08)" />
      <ellipse cx="44" cy="38" rx="26" ry="10" fill="#f0d9b0" />
      <path d="M18 40c2 18 14 28 26 28s24-10 26-28" fill="#e4b57a" />
      <ellipse cx="44" cy="40" rx="22" ry="8" fill="#f7e6c8" />
      <ellipse cx="44" cy="39" rx="16" ry="5" fill="#8ec8ea" />
      <path d="M36 28c4-8 16-8 18 2" stroke="#7ad7ea" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

function ArtTravel() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="24" ry="5" fill="rgba(25,6,61,0.08)" />
      <path d="M20 36h48l-4 28H24L20 36z" fill="#c07838" />
      <path d="M24 36h40l-3 22H27L24 36z" fill="#e8b86d" />
      <rect x="32" y="42" width="24" height="14" rx="7" fill="#7ad7ea" />
      <circle cx="40" cy="49" r="2.2" fill="#1a3a4d" />
      <circle cx="48" cy="49" r="2.2" fill="#1a3a4d" />
      <path d="M34 36c0-12 20-12 20 0" fill="none" stroke="#6b3a1e" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function ArtCollars() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <path
        d="M20 46c8-16 40-16 48 0 2 4-2 8-8 8H28c-6 0-10-4-8-8z"
        fill="#5c4d91"
      />
      <path d="M24 44c7-12 33-12 40 0" fill="none" stroke="#db89ca" strokeWidth="4" strokeLinecap="round" />
      <rect x="38" y="48" width="12" height="10" rx="2" fill="#f4d2a8" />
      <circle cx="44" cy="62" r="5" fill="#fd961e" />
    </>
  );
}

function ArtClothes() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <path d="M28 22l8 6h16l8-6 10 10-8 6v26H26V38l-8-6 10-10z" fill="#db89ca" />
      <path d="M36 28h16v8H36z" fill="#f4cfe8" />
      <circle cx="44" cy="48" r="4" fill="#fff" opacity="0.55" />
    </>
  );
}

function ArtShield() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <path d="M44 12l24 10v22c0 16-10 28-24 34C30 72 20 60 20 44V22L44 12z" fill="#15cca0" />
      <path d="M44 20l16 6v16c0 11-7 20-16 24-9-4-16-13-16-24V26L44 20z" fill="#8eebcf" />
      <path d="M36 44l6 6 12-14" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function ArtBeds() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="26" ry="5" fill="rgba(25,6,61,0.08)" />
      <ellipse cx="44" cy="52" rx="30" ry="16" fill="#c4b5e8" />
      <ellipse cx="44" cy="50" rx="22" ry="11" fill="#efeaf8" />
      <path d="M20 46c6-16 42-16 48 0" fill="#5c4d91" />
      <circle cx="54" cy="42" r="7" fill="#f4d2a8" />
      <circle cx="52.5" cy="40.5" r="1.4" fill="#3a2f62" />
    </>
  );
}

function ArtTrees() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <rect x="38" y="22" width="12" height="46" rx="3" fill="#c08a4a" />
      <rect x="22" y="48" width="28" height="8" rx="3" fill="#a87238" />
      <rect x="38" y="30" width="28" height="8" rx="3" fill="#a87238" />
      <circle cx="28" cy="36" r="14" fill="#5aae6a" />
      <circle cx="60" cy="24" r="12" fill="#6fc57c" />
      <path d="M24 54c8 0 10-10 4-14" stroke="#e8b86d" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

function ArtLitter() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="24" ry="5" fill="rgba(25,6,61,0.08)" />
      <path d="M16 38h56l-6 28H22L16 38z" fill="#8f8aa3" />
      <path d="M22 38h44l-5 22H27L22 38z" fill="#cfc9dc" />
      <ellipse cx="44" cy="50" rx="16" ry="6" fill="#e8d7a8" />
      <rect x="54" y="18" width="6" height="28" rx="2" fill="#5c4d91" transform="rotate(28 57 32)" />
      <path d="M62 18l12 6-8 4-4-10z" fill="#5c4d91" />
    </>
  );
}

function ArtBird() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <ellipse cx="40" cy="48" rx="20" ry="16" fill="#0ba5f2" />
      <ellipse cx="36" cy="46" rx="12" ry="10" fill="#7ad7ea" />
      <circle cx="58" cy="36" r="10" fill="#0ba5f2" />
      <circle cx="61" cy="34" r="2" fill="#19063d" />
      <path d="M68 36l10 2-10 4z" fill="#fd961e" />
      <path d="M22 50c-8 4-10 14-4 18" stroke="#5c4d91" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M34 64h16" stroke="#c08a4a" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function ArtRodent() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <circle cx="28" cy="30" r="10" fill="#e0b090" />
      <circle cx="56" cy="30" r="10" fill="#e0b090" />
      <circle cx="28" cy="30" r="5" fill="#f4d2a8" />
      <circle cx="56" cy="30" r="5" fill="#f4d2a8" />
      <ellipse cx="42" cy="48" rx="20" ry="18" fill="#e8c4a0" />
      <circle cx="36" cy="46" r="2.2" fill="#3a2f62" />
      <circle cx="50" cy="46" r="2.2" fill="#3a2f62" />
      <ellipse cx="42" cy="54" rx="4" ry="3" fill="#d9899a" />
      <path d="M62 52c10 2 14 12 8 18" stroke="#e8c4a0" strokeWidth="5" fill="none" strokeLinecap="round" />
    </>
  );
}

function ArtMore() {
  return (
    <>
      <ellipse cx="44" cy="74" rx="22" ry="5" fill="rgba(25,6,61,0.08)" />
      <circle cx="28" cy="34" r="9" fill="#5c4d91" />
      <circle cx="52" cy="28" r="8" fill="#db89ca" />
      <circle cx="60" cy="50" r="9" fill="#15cca0" />
      <circle cx="34" cy="56" r="8" fill="#fd961e" />
      <path
        d="M34 40c4-2 8-1 10 3 3-4 8-4 12-1"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.7"
      />
    </>
  );
}

const ART: Record<ShopCategoryArtKind, () => ReactElement> = {
  food: ArtFood,
  treats: ArtTreats,
  groom: ArtGroom,
  toys: ArtToys,
  bowls: ArtBowls,
  travel: ArtTravel,
  collars: ArtCollars,
  clothes: ArtClothes,
  shield: ArtShield,
  beds: ArtBeds,
  trees: ArtTrees,
  litter: ArtLitter,
  bird: ArtBird,
  rodent: ArtRodent,
  more: ArtMore,
};

export function ShopCategoryArt({ kind }: ArtProps) {
  const Inner = ART[kind] ?? ArtMore;
  return (
    <svg
      className="pd-shop-dk-art"
      viewBox="0 0 88 88"
      aria-hidden
      focusable="false"
    >
      <Inner />
    </svg>
  );
}

export function ShopCategoryMoreArt() {
  return <ShopCategoryArt kind="more" />;
}
