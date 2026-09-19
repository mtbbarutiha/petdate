/** Studio styles — the uploaded person and pet stay; only the background color changes. */

export type FantasyPhotoStyle = {
  id: string;
  labelFa: string;
  labelEn: string;
  /** Solid studio background the sample uses. */
  background: string;
  sampleUrl: string;
  prompt: string;
};

export const FANTASY_PHOTO_STYLES: readonly FantasyPhotoStyle[] = [
  {
    id: 'beige',
    labelFa: 'بژ',
    labelEn: 'Beige',
    background: '#E8D7C3',
    sampleUrl: '/pepito/uploads/reviews/fantasy-01.jpg',
    prompt:
      'Keep the exact same person and pet from the reference photo. Professional studio portrait, playful expression, chunky beige knit sweater matching a solid warm beige background, soft even lighting, waist-up, square, no text, no watermark.',
  },
  {
    id: 'yellow',
    labelFa: 'زرد',
    labelEn: 'Yellow',
    background: '#F2C200',
    sampleUrl: '/pepito/uploads/01-4.jpg',
    prompt:
      'Keep the exact same person and pet from the reference photo. Professional studio portrait, bright yellow chunky knit sweater matching a solid yellow background, cheerful smile, even studio light, waist-up, square, no text, no watermark.',
  },
  {
    id: 'pink',
    labelFa: 'صورتی',
    labelEn: 'Pink',
    background: '#F4A0C0',
    sampleUrl: '/pepito/uploads/04-4.jpg',
    prompt:
      'Keep the exact same person and pet from the reference photo. Professional studio portrait, white knit sweater with small red hearts, solid vibrant pink background, warm smile, even studio light, waist-up, square, no text, no watermark.',
  },
  {
    id: 'lilac',
    labelFa: 'یاسی',
    labelEn: 'Lilac',
    background: '#CDB4E0',
    sampleUrl: '/pepito/uploads/reviews/fantasy-04.jpg',
    prompt:
      'Keep the exact same person and pet from the reference photo. Professional studio portrait, mustard or lilac knit sweater, solid light purple background, joyful expression, even studio light, waist-up, square, no text, no watermark.',
  },
  {
    id: 'mint',
    labelFa: 'نعنایی',
    labelEn: 'Mint',
    background: '#B7E0C8',
    sampleUrl: '/pepito/uploads/reviews/fantasy-03.jpg',
    prompt:
      'Keep the exact same person and pet from the reference photo. Professional studio portrait, mint-green knit sweater matching a solid mint background, gentle smile, even studio light, waist-up, square, no text, no watermark.',
  },
  {
    id: 'coral',
    labelFa: 'مرجانی',
    labelEn: 'Coral',
    background: '#F0997B',
    sampleUrl: '/pepito/uploads/reviews/fantasy-02.jpg',
    prompt:
      'Keep the exact same person and pet from the reference photo. Professional studio portrait, coral knit sweater matching a solid coral background, playful smile, even studio light, waist-up, square, no text, no watermark.',
  },
] as const;

export function fantasyPhotoStyleById(id: string): FantasyPhotoStyle | null {
  return FANTASY_PHOTO_STYLES.find((s) => s.id === id) ?? null;
}
