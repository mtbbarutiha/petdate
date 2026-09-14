import type { LucideIcon } from 'lucide-react';
import {
  Backpack,
  Bath,
  BedDouble,
  Bird,
  Bone,
  Briefcase,
  CircleDot,
  Fish,
  Footprints,
  IceCream,
  LayoutGrid,
  Mouse,
  PawPrint,
  Rabbit,
  Scissors,
  Shield,
  Shirt,
  Sparkles,
  Toilet,
  Trees,
  UtensilsCrossed,
} from 'lucide-react';

/** Lucide tiles for shop category rail — no emoji-circle chrome. */
const BY_SLUG: Record<string, LucideIcon> = {
  'dog-food': Bone,
  'dog-treats': IceCream,
  'dog-grooming': Bath,
  'dog-toys': CircleDot,
  'dog-bowls': UtensilsCrossed,
  'dog-carriers-travel': Briefcase,
  'dog-carriers': Briefcase,
  'dog-collars': Footprints,
  'dog-accessories': Footprints,
  grooming: Scissors,
  'dog-clothing': Shirt,
  'dog-flea-tick': Shield,
  'dog-beds': BedDouble,
  'cat-food': Fish,
  'cat-treats': IceCream,
  'cat-grooming': Bath,
  'cat-toys': Mouse,
  'cat-trees': Trees,
  'cat-bowls': UtensilsCrossed,
  'cat-accessories': UtensilsCrossed,
  'cat-litter': Toilet,
  'cat-carriers-travel': Backpack,
  'cat-carriers': Backpack,
  'cat-beds': BedDouble,
  'cat-flea-tick': Shield,
  'bird-food': Bird,
  'bird-accessories': Bird,
  'rodent-supplies': Rabbit,
};

export function shopCategoryIcon(slug: string): LucideIcon {
  return BY_SLUG[slug] ?? PawPrint;
}

export const ShopCategoryMoreIcon = LayoutGrid;
