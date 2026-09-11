/** Catalog of pet species and breeds for registration wizards */

export type PetSpeciesCode = 'dog' | 'cat' | 'bird' | 'rabbit' | 'hamster' | 'other';

export interface PetSpecies {
  code: PetSpeciesCode;
  labelFa: string;
  emoji: string;
}

export interface PetBreed {
  id: number;
  speciesCode: PetSpeciesCode;
  nameFa: string;
  nameEn?: string;
  sortOrder?: number;
}

export const PET_SPECIES: PetSpecies[] = [
  { code: 'dog', labelFa: 'سگ', emoji: '🐕' },
  { code: 'cat', labelFa: 'گربه', emoji: '🐈' },
  { code: 'bird', labelFa: 'پرنده', emoji: '🐦' },
  { code: 'rabbit', labelFa: 'خرگوش', emoji: '🐇' },
  { code: 'hamster', labelFa: 'همستر', emoji: '🐹' },
  { code: 'other', labelFa: 'سایر', emoji: '🐾' },
];

/**
 * نژادها بر اساس فراوانی تقریبی در ایران (رایج‌تر = sortOrder کوچک‌تر)
 */
export const PET_BREEDS_SEED: Array<{
  speciesCode: PetSpeciesCode;
  nameFa: string;
  nameEn?: string;
  sortOrder: number;
}> = [
  // —— سگ ——
  { speciesCode: 'dog', nameFa: 'میکس / دورگه', nameEn: 'Mixed', sortOrder: 1 },
  { speciesCode: 'dog', nameFa: 'ژرمن شپرد', nameEn: 'German Shepherd', sortOrder: 2 },
  { speciesCode: 'dog', nameFa: 'هاسکی سیبری', nameEn: 'Siberian Husky', sortOrder: 3 },
  { speciesCode: 'dog', nameFa: 'گلدن رتریور', nameEn: 'Golden Retriever', sortOrder: 4 },
  { speciesCode: 'dog', nameFa: 'لابرادور', nameEn: 'Labrador Retriever', sortOrder: 5 },
  { speciesCode: 'dog', nameFa: 'پامرانین', nameEn: 'Pomeranian', sortOrder: 6 },
  { speciesCode: 'dog', nameFa: 'شیتزو', nameEn: 'Shih Tzu', sortOrder: 7 },
  { speciesCode: 'dog', nameFa: 'مالینویز', nameEn: 'Belgian Malinois', sortOrder: 8 },
  { speciesCode: 'dog', nameFa: 'پودل', nameEn: 'Poodle', sortOrder: 9 },
  { speciesCode: 'dog', nameFa: 'بولداگ فرانسوی', nameEn: 'French Bulldog', sortOrder: 10 },
  { speciesCode: 'dog', nameFa: 'چی‌واوا', nameEn: 'Chihuahua', sortOrder: 11 },
  { speciesCode: 'dog', nameFa: 'یورکشایر تریر', nameEn: 'Yorkshire Terrier', sortOrder: 12 },
  { speciesCode: 'dog', nameFa: 'مالتیز', nameEn: 'Maltese', sortOrder: 13 },
  { speciesCode: 'dog', nameFa: 'روتوایلر', nameEn: 'Rottweiler', sortOrder: 14 },
  { speciesCode: 'dog', nameFa: 'دوبرمن', nameEn: 'Doberman', sortOrder: 15 },
  { speciesCode: 'dog', nameFa: 'باکسر', nameEn: 'Boxer', sortOrder: 16 },
  { speciesCode: 'dog', nameFa: 'بیگل', nameEn: 'Beagle', sortOrder: 17 },
  { speciesCode: 'dog', nameFa: 'جک راسل', nameEn: 'Jack Russell Terrier', sortOrder: 18 },
  { speciesCode: 'dog', nameFa: 'داکسوند', nameEn: 'Dachshund', sortOrder: 19 },
  { speciesCode: 'dog', nameFa: 'کوکر اسپانیل', nameEn: 'Cocker Spaniel', sortOrder: 20 },
  { speciesCode: 'dog', nameFa: 'ساموید', nameEn: 'Samoyed', sortOrder: 21 },
  { speciesCode: 'dog', nameFa: 'اسپیتز', nameEn: 'Spitz', sortOrder: 22 },
  { speciesCode: 'dog', nameFa: 'پگ', nameEn: 'Pug', sortOrder: 23 },
  { speciesCode: 'dog', nameFa: 'بولداگ انگلیسی', nameEn: 'English Bulldog', sortOrder: 24 },
  { speciesCode: 'dog', nameFa: 'بوردر کولی', nameEn: 'Border Collie', sortOrder: 25 },
  { speciesCode: 'dog', nameFa: 'آکیتا', nameEn: 'Akita', sortOrder: 26 },
  { speciesCode: 'dog', nameFa: 'شیبا اینو', nameEn: 'Shiba Inu', sortOrder: 27 },
  { speciesCode: 'dog', nameFa: 'پیت‌بول', nameEn: 'Pit Bull', sortOrder: 28 },
  { speciesCode: 'dog', nameFa: 'استافوردشایر', nameEn: 'Staffordshire', sortOrder: 29 },
  { speciesCode: 'dog', nameFa: 'کن کورسو', nameEn: 'Cane Corso', sortOrder: 30 },
  { speciesCode: 'dog', nameFa: 'گریت دین', nameEn: 'Great Dane', sortOrder: 31 },
  { speciesCode: 'dog', nameFa: 'سنت برنارد', nameEn: 'Saint Bernard', sortOrder: 32 },
  { speciesCode: 'dog', nameFa: 'نیوفاندلند', nameEn: 'Newfoundland', sortOrder: 33 },
  { speciesCode: 'dog', nameFa: 'چاو چاو', nameEn: 'Chow Chow', sortOrder: 34 },
  { speciesCode: 'dog', nameFa: 'شر‌پی', nameEn: 'Shar Pei', sortOrder: 35 },
  { speciesCode: 'dog', nameFa: 'هاسکی آلاسکان', nameEn: 'Alaskan Malamute', sortOrder: 36 },
  { speciesCode: 'dog', nameFa: 'پامرانین توی', nameEn: 'Toy Pomeranian', sortOrder: 37 },
  { speciesCode: 'dog', nameFa: 'پودل توی', nameEn: 'Toy Poodle', sortOrder: 38 },
  { speciesCode: 'dog', nameFa: 'کاوالیر کینگ چارلز', nameEn: 'Cavalier King Charles', sortOrder: 39 },
  { speciesCode: 'dog', nameFa: 'ویپت', nameEn: 'Whippet', sortOrder: 40 },
  { speciesCode: 'dog', nameFa: 'گرهوند', nameEn: 'Greyhound', sortOrder: 41 },
  { speciesCode: 'dog', nameFa: 'آمریکن بولی', nameEn: 'American Bully', sortOrder: 42 },
  { speciesCode: 'dog', nameFa: 'بول ماستیف', nameEn: 'Bullmastiff', sortOrder: 43 },
  { speciesCode: 'dog', nameFa: 'ماستیف', nameEn: 'Mastiff', sortOrder: 44 },
  { speciesCode: 'dog', nameFa: 'پیکینیز', nameEn: 'Pekingese', sortOrder: 45 },
  { speciesCode: 'dog', nameFa: 'پاگ‌میکس', nameEn: 'Pug Mix', sortOrder: 46 },
  { speciesCode: 'dog', nameFa: 'تریر', nameEn: 'Terrier', sortOrder: 47 },
  { speciesCode: 'dog', nameFa: 'اسکاتیش تریر', nameEn: 'Scottish Terrier', sortOrder: 48 },
  { speciesCode: 'dog', nameFa: 'وست هایلند', nameEn: 'West Highland Terrier', sortOrder: 49 },
  { speciesCode: 'dog', nameFa: 'سگ نگهبان ایرانی', nameEn: 'Iranian Guard Dog', sortOrder: 50 },
  { speciesCode: 'dog', nameFa: 'سگ گله ایرانی', nameEn: 'Iranian Shepherd', sortOrder: 51 },
  { speciesCode: 'dog', nameFa: 'سالوکی / تازی', nameEn: 'Saluki', sortOrder: 52 },
  { speciesCode: 'dog', nameFa: 'افغانی', nameEn: 'Afghan Hound', sortOrder: 53 },
  { speciesCode: 'dog', nameFa: 'باسنجی', nameEn: 'Basenji', sortOrder: 54 },
  { speciesCode: 'dog', nameFa: 'برنیز ماونتین', nameEn: 'Bernese Mountain Dog', sortOrder: 55 },
  { speciesCode: 'dog', nameFa: 'بوستون تریر', nameEn: 'Boston Terrier', sortOrder: 56 },
  { speciesCode: 'dog', nameFa: 'بول تریر', nameEn: 'Bull Terrier', sortOrder: 57 },
  { speciesCode: 'dog', nameFa: 'دالماسین', nameEn: 'Dalmatian', sortOrder: 58 },
  { speciesCode: 'dog', nameFa: 'انگلیش ستر', nameEn: 'English Setter', sortOrder: 59 },
  { speciesCode: 'dog', nameFa: 'پوینتر', nameEn: 'Pointer', sortOrder: 60 },
  { speciesCode: 'dog', nameFa: 'ویمرانر', nameEn: 'Weimaraner', sortOrder: 61 },
  { speciesCode: 'dog', nameFa: 'هاسکی مینی', nameEn: 'Mini Husky', sortOrder: 62 },
  { speciesCode: 'dog', nameFa: 'کولی', nameEn: 'Collie', sortOrder: 63 },
  { speciesCode: 'dog', nameFa: 'شلتی', nameEn: 'Shetland Sheepdog', sortOrder: 64 },
  { speciesCode: 'dog', nameFa: 'پاپیون', nameEn: 'Papillon', sortOrder: 65 },
  { speciesCode: 'dog', nameFa: 'هاوانیز', nameEn: 'Havanese', sortOrder: 66 },
  { speciesCode: 'dog', nameFa: 'بیچون فریزه', nameEn: 'Bichon Frise', sortOrder: 67 },
  { speciesCode: 'dog', nameFa: 'لهاسا آپسو', nameEn: 'Lhasa Apso', sortOrder: 68 },
  { speciesCode: 'dog', nameFa: 'سایر نژاد سگ', nameEn: 'Other dog breed', sortOrder: 99 },

  // —— گربه ——
  { speciesCode: 'cat', nameFa: 'میکس / دورگه', nameEn: 'Mixed', sortOrder: 1 },
  { speciesCode: 'cat', nameFa: 'موکوتاه ایرانی', nameEn: 'Domestic Shorthair', sortOrder: 2 },
  { speciesCode: 'cat', nameFa: 'پرشین', nameEn: 'Persian', sortOrder: 3 },
  { speciesCode: 'cat', nameFa: 'اسکاتیش فولد', nameEn: 'Scottish Fold', sortOrder: 4 },
  { speciesCode: 'cat', nameFa: 'بریتیش شورت‌هیر', nameEn: 'British Shorthair', sortOrder: 5 },
  { speciesCode: 'cat', nameFa: 'سیامی', nameEn: 'Siamese', sortOrder: 6 },
  { speciesCode: 'cat', nameFa: 'مین‌کون', nameEn: 'Maine Coon', sortOrder: 7 },
  { speciesCode: 'cat', nameFa: 'بنگال', nameEn: 'Bengal', sortOrder: 8 },
  { speciesCode: 'cat', nameFa: 'راگدال', nameEn: 'Ragdoll', sortOrder: 9 },
  { speciesCode: 'cat', nameFa: 'هایلند فولد', nameEn: 'Highland Fold', sortOrder: 10 },
  { speciesCode: 'cat', nameFa: 'بریتیش لانگ‌هیر', nameEn: 'British Longhair', sortOrder: 11 },
  { speciesCode: 'cat', nameFa: 'اسفینکس', nameEn: 'Sphynx', sortOrder: 12 },
  { speciesCode: 'cat', nameFa: 'آبی روسی', nameEn: 'Russian Blue', sortOrder: 13 },
  { speciesCode: 'cat', nameFa: 'نروژی جنگلی', nameEn: 'Norwegian Forest', sortOrder: 14 },
  { speciesCode: 'cat', nameFa: 'آمریکن شورت‌هیر', nameEn: 'American Shorthair', sortOrder: 15 },
  { speciesCode: 'cat', nameFa: 'هیمالین', nameEn: 'Himalayan', sortOrder: 16 },
  { speciesCode: 'cat', nameFa: 'اکزوتیک شورت‌هیر', nameEn: 'Exotic Shorthair', sortOrder: 17 },
  { speciesCode: 'cat', nameFa: 'ابیسینین', nameEn: 'Abyssinian', sortOrder: 18 },
  { speciesCode: 'cat', nameFa: 'برمه‌ای', nameEn: 'Burmese', sortOrder: 19 },
  { speciesCode: 'cat', nameFa: 'سومالی', nameEn: 'Somali', sortOrder: 20 },
  { speciesCode: 'cat', nameFa: 'مانچیکین', nameEn: 'Munchkin', sortOrder: 21 },
  { speciesCode: 'cat', nameFa: 'ساوانا', nameEn: 'Savannah', sortOrder: 22 },
  { speciesCode: 'cat', nameFa: 'موبلند ایرانی', nameEn: 'Domestic Longhair', sortOrder: 23 },
  { speciesCode: 'cat', nameFa: 'انگورا ترک', nameEn: 'Turkish Angora', sortOrder: 24 },
  { speciesCode: 'cat', nameFa: 'وان ترک', nameEn: 'Turkish Van', sortOrder: 25 },
  { speciesCode: 'cat', nameFa: 'اوریانتال', nameEn: 'Oriental', sortOrder: 26 },
  { speciesCode: 'cat', nameFa: 'بمبئی', nameEn: 'Bombay', sortOrder: 27 },
  { speciesCode: 'cat', nameFa: 'چارتره', nameEn: 'Chartreux', sortOrder: 28 },
  { speciesCode: 'cat', nameFa: 'کورنیش رکس', nameEn: 'Cornish Rex', sortOrder: 29 },
  { speciesCode: 'cat', nameFa: 'دوون رکس', nameEn: 'Devon Rex', sortOrder: 30 },
  { speciesCode: 'cat', nameFa: 'مانکس', nameEn: 'Manx', sortOrder: 31 },
  { speciesCode: 'cat', nameFa: 'سینگاپورا', nameEn: 'Singapura', sortOrder: 32 },
  { speciesCode: 'cat', nameFa: 'تونکینز', nameEn: 'Tonkinese', sortOrder: 33 },
  { speciesCode: 'cat', nameFa: 'سایر نژاد گربه', nameEn: 'Other cat breed', sortOrder: 99 },

  // —— پرنده ——
  { speciesCode: 'bird', nameFa: 'بودجی / مرغ عشق', nameEn: 'Budgerigar', sortOrder: 1 },
  { speciesCode: 'bird', nameFa: 'عروس هلندی', nameEn: 'Cockatiel', sortOrder: 2 },
  { speciesCode: 'bird', nameFa: 'قناری', nameEn: 'Canary', sortOrder: 3 },
  { speciesCode: 'bird', nameFa: 'طوطی خاکستری / کاسکو', nameEn: 'African Grey', sortOrder: 4 },
  { speciesCode: 'bird', nameFa: 'لاوبرد', nameEn: 'Lovebird', sortOrder: 5 },
  { speciesCode: 'bird', nameFa: 'فنچ', nameEn: 'Finch', sortOrder: 6 },
  { speciesCode: 'bird', nameFa: 'کاکادو', nameEn: 'Cockatoo', sortOrder: 7 },
  { speciesCode: 'bird', nameFa: 'ماکائو', nameEn: 'Macaw', sortOrder: 8 },
  { speciesCode: 'bird', nameFa: 'آمازون', nameEn: 'Amazon Parrot', sortOrder: 9 },
  { speciesCode: 'bird', nameFa: 'سنجاقک / پاراکیت', nameEn: 'Parakeet', sortOrder: 10 },
  { speciesCode: 'bird', nameFa: 'مرغ مینا', nameEn: 'Myna', sortOrder: 11 },
  { speciesCode: 'bird', nameFa: 'کبوتر زینتی', nameEn: 'Fancy Pigeon', sortOrder: 12 },
  { speciesCode: 'bird', nameFa: 'طوطی برزیلی', nameEn: 'Conure', sortOrder: 13 },
  { speciesCode: 'bird', nameFa: 'روزلا', nameEn: 'Rosella', sortOrder: 14 },
  { speciesCode: 'bird', nameFa: 'اکلکتوس', nameEn: 'Eclectus', sortOrder: 15 },
  { speciesCode: 'bird', nameFa: 'مرغ بهشتی', nameEn: 'Bird of Paradise', sortOrder: 16 },
  { speciesCode: 'bird', nameFa: 'فنچ گولدین', nameEn: 'Gouldian Finch', sortOrder: 17 },
  { speciesCode: 'bird', nameFa: 'سهره', nameEn: 'Goldfinch', sortOrder: 19 },
  { speciesCode: 'bird', nameFa: 'بلبل', nameEn: 'Nightingale', sortOrder: 20 },
  { speciesCode: 'bird', nameFa: 'طوطی کوتوله', nameEn: 'Parrotlet', sortOrder: 21 },
  { speciesCode: 'bird', nameFa: 'مرغ خانگی زینتی', nameEn: 'Fancy Chicken', sortOrder: 22 },
  { speciesCode: 'bird', nameFa: 'اردک زینتی', nameEn: 'Fancy Duck', sortOrder: 23 },
  { speciesCode: 'bird', nameFa: 'سایر پرندگان', nameEn: 'Other bird', sortOrder: 99 },

  // —— خرگوش ——
  { speciesCode: 'rabbit', nameFa: 'میکس خرگوش', nameEn: 'Mixed rabbit', sortOrder: 1 },
  { speciesCode: 'rabbit', nameFa: 'هولند لوپ', nameEn: 'Holland Lop', sortOrder: 2 },
  { speciesCode: 'rabbit', nameFa: 'مینی رکس', nameEn: 'Mini Rex', sortOrder: 3 },
  { speciesCode: 'rabbit', nameFa: 'شیرلوپ', nameEn: 'Lionhead', sortOrder: 4 },
  { speciesCode: 'rabbit', nameFa: 'انگورا', nameEn: 'Angora', sortOrder: 5 },
  { speciesCode: 'rabbit', nameFa: 'دافی', nameEn: 'Dutch', sortOrder: 6 },
  { speciesCode: 'rabbit', nameFa: 'فلورییدا وایت', nameEn: 'Florida White', sortOrder: 7 },
  { speciesCode: 'rabbit', nameFa: 'نیدرلند دوارف', nameEn: 'Netherland Dwarf', sortOrder: 8 },
  { speciesCode: 'rabbit', nameFa: 'مینی لوپ', nameEn: 'Mini Lop', sortOrder: 9 },
  { speciesCode: 'rabbit', nameFa: 'رکس', nameEn: 'Rex', sortOrder: 10 },
  { speciesCode: 'rabbit', nameFa: 'کالیفرنیا', nameEn: 'Californian', sortOrder: 11 },
  { speciesCode: 'rabbit', nameFa: 'نیوزلند', nameEn: 'New Zealand', sortOrder: 12 },
  { speciesCode: 'rabbit', nameFa: 'فلاندی جاینت', nameEn: 'Flemish Giant', sortOrder: 13 },
  { speciesCode: 'rabbit', nameFa: 'سایر نژاد خرگوش', nameEn: 'Other rabbit', sortOrder: 99 },

  // —— همستر ——
  { speciesCode: 'hamster', nameFa: 'سوری', nameEn: 'Syrian', sortOrder: 1 },
  { speciesCode: 'hamster', nameFa: 'کوتوله کمپل', nameEn: 'Campbell Dwarf', sortOrder: 2 },
  { speciesCode: 'hamster', nameFa: 'روبوروفسکی', nameEn: 'Roborovski', sortOrder: 3 },
  { speciesCode: 'hamster', nameFa: 'وینتر وایت', nameEn: 'Winter White', sortOrder: 4 },
  { speciesCode: 'hamster', nameFa: 'چینی', nameEn: 'Chinese Hamster', sortOrder: 5 },
  { speciesCode: 'hamster', nameFa: 'میکس همستر', nameEn: 'Mixed hamster', sortOrder: 6 },
  { speciesCode: 'hamster', nameFa: 'سایر همستر', nameEn: 'Other hamster', sortOrder: 99 },

  // —— سایر ——
  { speciesCode: 'other', nameFa: 'لاک‌پشت', nameEn: 'Turtle', sortOrder: 1 },
  { speciesCode: 'other', nameFa: 'لاک‌پشت آبی', nameEn: 'Aquatic Turtle', sortOrder: 2 },
  { speciesCode: 'other', nameFa: 'ایگوآنا', nameEn: 'Iguana', sortOrder: 3 },
  { speciesCode: 'other', nameFa: 'جوجه تیغی', nameEn: 'Hedgehog', sortOrder: 4 },
  { speciesCode: 'other', nameFa: 'فرت', nameEn: 'Ferret', sortOrder: 5 },
  { speciesCode: 'other', nameFa: 'خوکچه هندی', nameEn: 'Guinea Pig', sortOrder: 6 },
  { speciesCode: 'other', nameFa: 'چینچیلا', nameEn: 'Chinchilla', sortOrder: 7 },
  { speciesCode: 'other', nameFa: 'ماهی زینتی', nameEn: 'Ornamental Fish', sortOrder: 8 },
  { speciesCode: 'other', nameFa: 'گلدن فیش / ماهی قرمز', nameEn: 'Goldfish', sortOrder: 9 },
  { speciesCode: 'other', nameFa: 'بتا', nameEn: 'Betta', sortOrder: 10 },
  { speciesCode: 'other', nameFa: 'موش خانگی', nameEn: 'Pet Mouse', sortOrder: 11 },
  { speciesCode: 'other', nameFa: 'رت / موش صحرایی', nameEn: 'Rat', sortOrder: 12 },
  { speciesCode: 'other', nameFa: 'مارمولک ریش‌دار', nameEn: 'Bearded Dragon', sortOrder: 13 },
  { speciesCode: 'other', nameFa: 'گکو', nameEn: 'Gecko', sortOrder: 14 },
  { speciesCode: 'other', nameFa: 'اسنیک / مار خانگی', nameEn: 'Pet Snake', sortOrder: 15 },
  { speciesCode: 'other', nameFa: 'قورباغه', nameEn: 'Frog', sortOrder: 16 },
  { speciesCode: 'other', nameFa: 'سایر حیوانات خانگی', nameEn: 'Other', sortOrder: 99 },
];

export const PET_SPECIES_LABELS: Record<string, string> = Object.fromEntries(
  PET_SPECIES.map((s) => [s.code, `${s.emoji} ${s.labelFa}`])
);

export const PET_GENDER_LABELS: Record<'male' | 'female', string> = {
  male: '♂ نر',
  female: '♀ ماده',
};

export const PET_SIZE_LABELS: Record<'small' | 'medium' | 'large', string> = {
  small: '🐁 کوچک',
  medium: '🐕 متوسط',
  large: '🦮 بزرگ',
};
