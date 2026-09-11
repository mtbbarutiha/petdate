/** Pepito adoption pets — shared by landing cards and detail pages */

const P = '/pepito/uploads';

export type AdoptionDetail = { labelKey: string; valueKey: string; valueVars?: Record<string, string | number> };

export type AdoptionPet = {
  slug: string;
  nameKey: string;
  img: string;
  bannerImg: string;
  gallery: string[];
  details: AdoptionDetail[];
  aboutKey: string;
  traitKeys: string[];
  rulesKey: string;
};

export const ADOPTION_PETS: AdoptionPet[] = [
  {
    slug: 'missy',
    nameKey: 'adoption.nameMissy',
    img: `${P}/01-2.jpg`,
    bannerImg: `${P}/01-2.jpg`,
    gallery: [`${P}/01-2.jpg`, `${P}/01.jpg`, `${P}/09-2.jpg`],
    details: [
      { labelKey: 'adoption.labelGender', valueKey: 'adoption.valFemale' },
      { labelKey: 'adoption.labelNeutered', valueKey: 'adoption.valNo' },
      { labelKey: 'adoption.labelAge', valueKey: 'adoption.ageYears', valueVars: { n: 5 } },
      { labelKey: 'adoption.labelBreed', valueKey: 'adoption.valMix' },
      { labelKey: 'adoption.labelVaccinated', valueKey: 'adoption.valYes' },
      { labelKey: 'adoption.labelSize', valueKey: 'adoption.valMedium' },
    ],
    aboutKey: 'adoption.aboutMissy',
    traitKeys: ['adoption.traitDogFriendly', 'adoption.traitApartment', 'adoption.traitKids'],
    rulesKey: 'adoption.rules',
  },
  {
    slug: 'bella',
    nameKey: 'adoption.nameBella',
    img: `${P}/02-2.jpg`,
    bannerImg: `${P}/02-2.jpg`,
    gallery: [`${P}/02-2.jpg`, `${P}/02.jpg`, `${P}/09-2.jpg`],
    details: [
      { labelKey: 'adoption.labelGender', valueKey: 'adoption.valMale' },
      { labelKey: 'adoption.labelNeutered', valueKey: 'adoption.valNo' },
      { labelKey: 'adoption.labelAge', valueKey: 'adoption.ageYears', valueVars: { n: 3 } },
      { labelKey: 'adoption.labelBreed', valueKey: 'adoption.valMix' },
      { labelKey: 'adoption.labelVaccinated', valueKey: 'adoption.valYes' },
      { labelKey: 'adoption.labelSize', valueKey: 'adoption.valLarge' },
    ],
    aboutKey: 'adoption.aboutBella',
    traitKeys: ['adoption.traitDogFriendly', 'adoption.traitOutdoor', 'adoption.traitKids'],
    rulesKey: 'adoption.rules',
  },
  {
    slug: 'kitty',
    nameKey: 'adoption.nameKitty',
    img: `${P}/03-2.jpg`,
    bannerImg: `${P}/03-2.jpg`,
    gallery: [`${P}/03-2.jpg`, `${P}/03.jpg`, `${P}/09-2.jpg`],
    details: [
      { labelKey: 'adoption.labelGender', valueKey: 'adoption.valFemale' },
      { labelKey: 'adoption.labelNeutered', valueKey: 'adoption.valYes' },
      { labelKey: 'adoption.labelAge', valueKey: 'adoption.ageYears', valueVars: { n: 2 } },
      { labelKey: 'adoption.labelBreed', valueKey: 'adoption.valMix' },
      { labelKey: 'adoption.labelVaccinated', valueKey: 'adoption.valYes' },
      { labelKey: 'adoption.labelSize', valueKey: 'adoption.valSmall' },
    ],
    aboutKey: 'adoption.aboutKitty',
    traitKeys: ['adoption.traitCatFriendly', 'adoption.traitApartment', 'adoption.traitKids'],
    rulesKey: 'adoption.rules',
  },
  {
    slug: 'penny',
    nameKey: 'adoption.namePenny',
    img: `${P}/04-2.jpg`,
    bannerImg: `${P}/5.jpg`,
    gallery: [`${P}/adoption.jpg`, `${P}/04-2.jpg`, `${P}/09-2.jpg`],
    details: [
      { labelKey: 'adoption.labelGender', valueKey: 'adoption.valMale' },
      { labelKey: 'adoption.labelNeutered', valueKey: 'adoption.valNo' },
      { labelKey: 'adoption.labelAge', valueKey: 'adoption.ageYears', valueVars: { n: 1 } },
      { labelKey: 'adoption.labelBreed', valueKey: 'adoption.valBeagle' },
      { labelKey: 'adoption.labelVaccinated', valueKey: 'adoption.valYes' },
      { labelKey: 'adoption.labelSize', valueKey: 'adoption.valMedium' },
    ],
    aboutKey: 'adoption.aboutPenny',
    traitKeys: ['adoption.traitDogFriendly', 'adoption.traitApartment', 'adoption.traitKids'],
    rulesKey: 'adoption.rules',
  },
];

export function getAdoptionPet(slug: string | undefined): AdoptionPet | undefined {
  if (!slug) return undefined;
  return ADOPTION_PETS.find((p) => p.slug === slug);
}
