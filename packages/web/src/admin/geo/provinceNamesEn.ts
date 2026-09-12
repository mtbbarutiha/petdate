/** English display names for Iran provinces (API / SVG keys stay Persian). */
export const IRAN_PROVINCE_NAME_EN: Record<string, { name: string; short: string }> = {
  'آذربایجان شرقی': { name: 'East Azerbaijan', short: 'E. Azarb.' },
  'آذربایجان غربی': { name: 'West Azerbaijan', short: 'W. Azarb.' },
  'اردبیل': { name: 'Ardabil', short: 'Ardabil' },
  'اصفهان': { name: 'Isfahan', short: 'Isfahan' },
  'البرز': { name: 'Alborz', short: 'Alborz' },
  'ایلام': { name: 'Ilam', short: 'Ilam' },
  'بوشهر': { name: 'Bushehr', short: 'Bushehr' },
  'تهران': { name: 'Tehran', short: 'Tehran' },
  'خراسان جنوبی': { name: 'South Khorasan', short: 'S. Khorasan' },
  'خراسان رضوی': { name: 'Razavi Khorasan', short: 'R. Khorasan' },
  'خراسان شمالی': { name: 'North Khorasan', short: 'N. Khorasan' },
  'خوزستان': { name: 'Khuzestan', short: 'Khuzestan' },
  'زنجان': { name: 'Zanjan', short: 'Zanjan' },
  'سمنان': { name: 'Semnan', short: 'Semnan' },
  'سیستان و بلوچستان': { name: 'Sistan and Baluchestan', short: 'Sistan' },
  'فارس': { name: 'Fars', short: 'Fars' },
  'قزوین': { name: 'Qazvin', short: 'Qazvin' },
  'قم': { name: 'Qom', short: 'Qom' },
  'لرستان': { name: 'Lorestan', short: 'Lorestan' },
  'مازندران': { name: 'Mazandaran', short: 'Mazandaran' },
  'مرکزی': { name: 'Markazi', short: 'Markazi' },
  'هرمزگان': { name: 'Hormozgan', short: 'Hormozgan' },
  'همدان': { name: 'Hamadan', short: 'Hamadan' },
  'چهارمحال و بختیاری': { name: 'Chaharmahal and Bakhtiari', short: 'Chaharmahal' },
  'کردستان': { name: 'Kurdistan', short: 'Kurdistan' },
  'کرمان': { name: 'Kerman', short: 'Kerman' },
  'کرمانشاه': { name: 'Kermanshah', short: 'Kermanshah' },
  'کهگیلویه و بویراحمد': { name: 'Kohgiluyeh and Boyer-Ahmad', short: 'Kohgiluyeh' },
  'گلستان': { name: 'Golestan', short: 'Golestan' },
  'گیلان': { name: 'Gilan', short: 'Gilan' },
  'یزد': { name: 'Yazd', short: 'Yazd' },
};

export function provinceDisplayName(nameFa: string, short = false): string {
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('lang') === 'en') {
    const hit = IRAN_PROVINCE_NAME_EN[nameFa];
    if (hit) return short ? hit.short : hit.name;
  }
  return nameFa;
}
