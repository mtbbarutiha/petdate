/**
 * Shared help / FAQ copy for @Petdatebot and petdate.ir.
 * FA is primary; EN is for existing i18n. Document only live flows.
 */
import { BRAND } from './brand';
import {
  FACE_VERIFY_REWARD,
  PLAYDATE_REQUEST_COST,
  QUICK_VET_COST,
  REFERRAL_BONUS_COINS,
  SEEKER_ADVICE_COST,
  SEEKER_OWNER_SHARE,
  SIGNUP_BONUS,
  TRAINER_CONSULT_COST,
  TRAINER_PROVIDER_SHARE,
} from './economy';
import { primaryRole, toPersianDigits, USER_ROLES, type UserRole } from './petdate';

export type HelpLang = 'fa' | 'en';
export type HelpAudience = UserRole | 'guest';
export type HelpSurface = 'bot' | 'web';

export type HelpSectionId =
  | 'account'
  | 'roles'
  | 'playmates'
  | 'chats'
  | 'pets'
  | 'diary'
  | 'wallet'
  | 'shop'
  | 'invite'
  | 'verify'
  | 'consults'
  | 'games'
  | 'adoption'
  | 'magazine'
  | 'support'
  | 'profile';

export interface LocalizedHelp {
  fa: string;
  en: string;
}

export interface HelpTopic {
  id: string;
  section: HelpSectionId;
  audiences: Array<HelpAudience | 'all'>;
  surfaces: HelpSurface[];
  title: LocalizedHelp;
  what: LocalizedHelp;
  how: LocalizedHelp;
  tips?: LocalizedHelp;
  /** Short Telegram inline-button label (FA). */
  botLabel?: string;
  sitePath?: string;
}

export interface HelpFaqItem {
  id: string;
  q: LocalizedHelp;
  a: LocalizedHelp;
}

export const HELP_STRUCTURE: Record<'what' | 'how' | 'tips', LocalizedHelp> = {
  what: { fa: 'چیست', en: 'What it is' },
  how: { fa: 'چطور استفاده کن', en: 'How to use' },
  tips: { fa: 'نکته', en: 'Tip' },
};

export const HELP_SECTION_LABELS: Record<HelpSectionId, LocalizedHelp> = {
  account: { fa: 'حساب وب و ربات', en: 'Web & bot account' },
  roles: { fa: 'نقش‌ها', en: 'Roles' },
  playmates: { fa: 'همبازی', en: 'Playmates' },
  chats: { fa: 'گفتگوها', en: 'Chats' },
  pets: { fa: 'پت‌های من', en: 'My pets' },
  diary: { fa: 'دفتر خاطرات', en: 'Pet diary' },
  wallet: { fa: 'کیف پول و سکه', en: 'Wallet & coins' },
  shop: { fa: 'پت‌شاپ', en: 'Pet shop' },
  invite: { fa: 'دعوت دوستان', en: 'Invite friends' },
  verify: { fa: 'احراز هویت', en: 'Verification' },
  consults: { fa: 'مشاوره دامپزشک و مربی', en: 'Vet & trainer consults' },
  games: { fa: 'بازی‌ها', en: 'Games' },
  adoption: { fa: 'پذیرش پت', en: 'Adoption' },
  magazine: { fa: 'مجله', en: 'Magazine' },
  support: { fa: 'پشتیبانی', en: 'Support' },
  profile: { fa: 'پروفایل', en: 'Profile' },
};

const FA_PLAYDATE = toPersianDigits(PLAYDATE_REQUEST_COST);
const FA_VET_MIN = toPersianDigits(QUICK_VET_COST);
const FA_TRAINER = toPersianDigits(TRAINER_CONSULT_COST);
const FA_TRAINER_SHARE = toPersianDigits(TRAINER_PROVIDER_SHARE);
const FA_SEEKER = toPersianDigits(SEEKER_ADVICE_COST);
const FA_SEEKER_SHARE = toPersianDigits(SEEKER_OWNER_SHARE);
const FA_REFERRAL = toPersianDigits(REFERRAL_BONUS_COINS);
const FA_SIGNUP = toPersianDigits(SIGNUP_BONUS);
const FA_FACE = toPersianDigits(FACE_VERIFY_REWARD);

export const HELP_ROLE_INTROS: Record<
  HelpAudience,
  { title: LocalizedHelp; what: LocalizedHelp; how: LocalizedHelp; tips: LocalizedHelp }
> = {
  guest: {
    title: { fa: `راهنمای مهمان — ${BRAND.displayNameFa}`, en: `Guest help — ${BRAND.displayName}` },
    what: {
      fa: `${BRAND.displayNameFa} پلتفرم فارسی همبازی پت، پت‌شاپ، پذیرش، بازی‌های گروهی و مشاوره دامپزشک/مربی است. وب و ربات تلگرام یک حساب مشترک دارند.`,
      en: `${BRAND.displayName} is a Persian playmate, shop, adoption, group-games, and vet/trainer platform. Web and Telegram share one account.`,
    },
    how: {
      fa: 'بدون ورود می‌توانی لندینگ، شاپ، مجله، پذیرش، بازی‌ها و صفحه دامپزشک را ببینی. برای همبازی، ثبت پت، چت، کیف پول و ثبت سفارش با پیامک OTP یا تلگرام وارد شو و یک نقش انتخاب کن.',
      en: 'Landing, shop, magazine, adoption, games, and the vet page are open. Sign in with SMS OTP or Telegram to use playmates, pets, chat, wallet, and checkout — then pick a role.',
    },
    tips: {
      fa: 'بعد از ورود، نقش صاحب پت، دامپزشک، مربی یا بدون پت را بزن. همان شماره، پت‌ها و گفتگوها را بین وب و @Petdatebot همگام می‌کند.',
      en: 'After login, choose pet owner, vet, trainer, or no-pet. The same phone keeps pets and chats in sync between the site and @Petdatebot.',
    },
  },
  pet_owner: {
    title: { fa: `راهنمای صاحب پت — ${BRAND.displayNameFa}`, en: `Pet-owner help — ${BRAND.displayName}` },
    what: {
      fa: 'نقش صاحب پت برای ثبت پت، پیدا کردن همبازی، دفتر خاطرات، مشاوره دامپزشک و مربی، شاپ و کیف پول است.',
      en: 'Pet-owner is for registering pets, finding playmates, the diary, vet/trainer consults, shop, and wallet.',
    },
    how: {
      fa: 'در ربات از منوی همین نقش استفاده کن؛ در سایت از پنل، هم‌بازی، پت‌های من، مشاوره سریع و مربی. جزئیات هر بخش را از دکمه‌های راهنما یا صفحهٔ راهنمای سایت ببین.',
      en: 'Use this role’s bot menu, or the site panel, playmates, My pets, quick consult, and trainer pages. Open a topic below or the site Help page for steps.',
    },
    tips: {
      fa: `درخواست همبازی ${FA_PLAYDATE} سکه است. پت را کامل ثبت کن تا پیشنهادها دقیق‌تر شود.`,
      en: `A playmate request costs ${PLAYDATE_REQUEST_COST} coins. Complete the pet profile so matches are more accurate.`,
    },
  },
  vet: {
    title: { fa: `راهنمای دامپزشک — ${BRAND.displayNameFa}`, en: `Vet help — ${BRAND.displayName}` },
    what: {
      fa: 'نقش دامپزشک برای پذیرش مشاوره آنلاین، دیدن بیماران اخیر، تنظیم تعرفه ویزیت و چت درمان روی همان حساب وب و ربات است.',
      en: 'The vet role is for taking online consults, recent patients, visit fees, and treatment chat on the shared web/bot account.',
    },
    how: {
      fa: 'آنلاین شو تا در لیست پزشک‌های آماده باشی. درخواست را بپذیر؛ چت در ربات و سایت یکی است. تعرفه را از منوی ربات تنظیم کن. احراز موبایل برای دامپزشک اجباری است.',
      en: 'Go online to appear as available. Accept a request — chat is the same on bot and site. Set your fee in the bot menu. Phone verification is required for vets.',
    },
    tips: {
      fa: 'آفلاین که باشی درخواست جدید نمی‌آید. مدرک دامپزشک را از پروفایل بفرست تا ادمین تأیید کند.',
      en: 'While offline you will not get new requests. Upload your credential from Profile so admin can verify it.',
    },
  },
  trainer: {
    title: { fa: `راهنمای مربی — ${BRAND.displayNameFa}`, en: `Trainer help — ${BRAND.displayName}` },
    what: {
      fa: 'نقش مربی برای پذیرش آموزش آنلاین پت (رفتار و فرمان‌پذیری) است — بدون ابزار پزشکی.',
      en: 'The trainer role is for online pet coaching (behavior and cues) — no medical tools.',
    },
    how: {
      fa: 'مدرک مربی را آپلود کن، آنلاین شو و درخواست‌ها را از مراجعان اخیر یا پنل مربی سایت بپذیر. چت آموزش روی وب و ربات مشترک است.',
      en: 'Upload your trainer credential, go online, and accept requests from recent clients or the site trainer panel. Training chat is shared on web and bot.',
    },
    tips: {
      fa: `هر مشاوره مربی ${FA_TRAINER} سکه است؛ سهم مربی ${FA_TRAINER_SHARE} سکه است.`,
      en: `Each trainer consult costs ${TRAINER_CONSULT_COST} coins; the trainer share is ${TRAINER_PROVIDER_SHARE} coins.`,
    },
  },
  no_pet: {
    title: { fa: `راهنمای بدون پت — ${BRAND.displayNameFa}`, en: `No-pet help — ${BRAND.displayName}` },
    what: {
      fa: 'نقش بدون پت برای کسی است که هنوز پت ندارد: مشورت با صاحبین، شاپ، پذیرش و مجله — بدون منوی همبازی.',
      en: 'No-pet is for people who do not have a pet yet: owner advice, shop, adoption, and magazine — no playmate menu.',
    },
    how: {
      fa: 'از «مشورت با صاحبین» در ربات یا گفتگوهای سایت درخواست بده. پذیرش و شاپ برای مهمان هم باز است. اگر پت گرفتی، از نقش‌های من نقش صاحب پت را اضافه کن.',
      en: 'Use “Ask owners” in the bot or site chats. Adoption and shop are also open to guests. When you get a pet, add the pet-owner role from My roles.',
    },
    tips: {
      fa: `مشورت با صاحبین ${FA_SEEKER} سکه است. اگر چت خیلی زود قطع شود هزینه برمی‌گردد.`,
      en: `Owner advice costs ${SEEKER_ADVICE_COST} coins. If the chat ends almost immediately, the fee is refunded.`,
    },
  },
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'account',
    section: 'account',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'حساب مشترک وب و ربات', en: 'Shared web & bot account' },
    what: {
      fa: 'یک نفر = یک حساب. پت‌ها، درخواست همبازی، گفتگوها، سفارش شاپ و موجودی کیف پول روی دیتابیس مشترک وب و تلگرام می‌مانند.',
      en: 'One person, one account. Pets, playmate requests, chats, shop orders, and wallet balances live on the shared web/Telegram database.',
    },
    how: {
      fa: 'در سایت با پیامک OTP یا اتصال تلگرام وارد شو. در ربات /start بزن. همان شماره موبایل، داده‌ها را یکی می‌کند.',
      en: 'On the site, sign in with SMS OTP or Telegram. In the bot, send /start. The same mobile number keeps data in sync.',
    },
    tips: {
      fa: 'اگر روی وب هستی و طرف مقابل روی ربات، پیام از API مشترک رد می‌شود؛ هر دو همان مکالمه را می‌بینند.',
      en: 'If you are on web and the other person is on the bot, messages go through the shared API — both see the same conversation.',
    },
    botLabel: 'حساب وب و ربات',
    sitePath: '/faq#account',
  },
  {
    id: 'roles',
    section: 'roles',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'نقش‌ها', en: 'Roles' },
    what: {
      fa: 'نقش‌های زنده: صاحب پت، دامپزشک، مربی و بدون پت. می‌توانی چند نقش داشته باشی؛ منو و پنل مال نقش فعال است.',
      en: 'Live roles: pet owner, vet, trainer, and no-pet. You can hold several; menus follow the active role.',
    },
    how: {
      fa: 'در ربات «نقش‌های من» و در سایت سوییچ نقش یا /onboarding/role. نقش فعال را عوض کن تا منوی همان نقش بیاید.',
      en: 'Use My roles in the bot, or the site role switcher / onboarding. Switch the active role to change the menu.',
    },
    tips: {
      fa: 'نقش پرستار پت و «دنبال پت» از محصول حذف شده‌اند؛ نزدیک‌ترین نقش‌ها صاحب پت و بدون پت هستند.',
      en: 'Pet-sitter and “looking for a pet” were removed; the nearest roles are pet owner and no-pet.',
    },
    botLabel: 'نقش‌ها',
    sitePath: '/faq#roles',
  },
  {
    id: 'playmate',
    section: 'playmates',
    audiences: ['pet_owner'],
    surfaces: ['bot', 'web'],
    title: { fa: 'پیدا کردن همبازی', en: 'Find a playmate' },
    what: {
      fa: `صاحب پت می‌تواند برای پت خودش درخواست همبازی بفرستد. یک درخواست ${FA_PLAYDATE} سکه از درخواست‌کننده کم می‌کند.`,
      en: `Pet owners can send a playmate request for their pet. One request costs ${PLAYDATE_REQUEST_COST} coins.`,
    },
    how: {
      fa: 'ربات: «پیدا کردن همبازی» را بزن و پت مبدأ را انتخاب کن — درخواست به هم‌گروه‌ها می‌رود. سایت: از هم بازی / گفتگوها درخواست بفرست. بعد از پذیرش، چت باز می‌شود.',
      en: 'Bot: tap Find a playmate and pick your pet — the request goes to matching groups. Site: send a request from Playmates / Chats. Chat opens after accept.',
    },
    tips: {
      fa: 'بدون پت ثبت‌شده همبازی ساخته نمی‌شود. اگر سکه کم است از کیف پول شارژ کن. درخواست منقضی می‌شود؛ می‌توانی دوباره بفرستی.',
      en: 'You need a registered pet. Top up coins in the wallet if needed. Requests expire; you can send again.',
    },
    botLabel: 'همبازی',
    sitePath: '/chats',
  },
  {
    id: 'nearby',
    section: 'playmates',
    audiences: ['pet_owner'],
    surfaces: ['bot'],
    title: { fa: 'پت‌های نزدیک', en: 'Nearby pets' },
    what: {
      fa: 'در ربات، پت‌های نزدیک را بر اساس موقعیتی که می‌فرستی می‌بینی — جدا از لیست هم‌استانی.',
      en: 'In the bot you can see nearby pets from the location you share — separate from same-province search.',
    },
    how: {
      fa: '«پت‌های نزدیک» را بزن و موقعیت را با دکمه تلگرام بفرست. شعاع را انتخاب کن تا کارت پت‌ها بیاید.',
      en: 'Tap Nearby pets and share location with Telegram’s button. Pick a radius to see pet cards.',
    },
    tips: {
      fa: 'موقعیت فقط برای همین جستجو به حسابت ذخیره می‌شود تا نتایج نزدیک‌تر باشد.',
      en: 'Location is stored on your account for this search so results can be closer.',
    },
    botLabel: 'پت‌های نزدیک',
  },
  {
    id: 'search',
    section: 'playmates',
    audiences: ['pet_owner'],
    surfaces: ['bot'],
    title: { fa: 'جستجوی پت', en: 'Search pets' },
    what: {
      fa: 'جستجوی پت‌های ثبت‌شده: هم‌استان، هم‌نژاد، همه، جدید و محبوب.',
      en: 'Search registered pets: same province, same breed, all, newest, and popular.',
    },
    how: {
      fa: 'از «جستجوی پت» حالت را انتخاب کن. می‌توانی جستجوی پیشرفته را هم باز کنی و پروفایل پت را ببینی.',
      en: 'Open Search pets and pick a mode. Advanced search is available; you can open a pet profile from the results.',
    },
    tips: {
      fa: 'برای درخواست همبازی از کارت پت اقدام کن؛ هزینه همان درخواست همبازی است.',
      en: 'Send a playmate request from a pet card; the usual playmate fee applies.',
    },
    botLabel: 'جستجوی پت',
  },
  {
    id: 'chats',
    section: 'chats',
    audiences: ['all'],
    surfaces: ['web'],
    title: { fa: 'گفتگوها', en: 'Chats' },
    what: {
      fa: 'صندوق گفتگوهای سایت: همبازی، مشاوره دامپزشک، مربی و مشورت با صاحبین. پیام‌ها با ربات یکی است.',
      en: 'Site inbox for playmates, vet consults, trainer chats, and owner advice. Messages match the bot.',
    },
    how: {
      fa: 'از منو «هم بازی» یا «گفتگوها» را باز کن. کارت درخواست را بپذیر یا رد کن. بعد از پذیرش می‌توانی متن، عکس و ویس بفرستی.',
      en: 'Open Playmates or Chats. Accept or decline a request card. After accept you can send text, photos, and voice.',
    },
    tips: {
      fa: 'سایلنت درخواست همبازی را از گفتگو می‌توانی روشن کنی تا درخواست جدید نیاید. چت امن را در همان پنجره تمام و پاک کن.',
      en: 'You can mute new playmate requests from the chat screen. End and wipe a secure chat from the same window.',
    },
    sitePath: '/chats',
  },
  {
    id: 'pets',
    section: 'pets',
    audiences: ['pet_owner'],
    surfaces: ['bot', 'web'],
    title: { fa: 'پت‌های من', en: 'My pets' },
    what: {
      fa: 'هر پت پروفایل جدا دارد: عکس، گونه، نژاد، سن و وضعیت همبازی — جدا از پروفایل صاحب.',
      en: 'Each pet has its own profile: photo, species, breed, age, and playmate status — separate from the owner profile.',
    },
    how: {
      fa: 'ربات: «پت‌های من» یا «ثبت پت». سایت: پت‌های من / افزودن پت. ویزارد عکس و مشخصات را می‌گیرد.',
      en: 'Bot: My pets or Add pet. Site: My pets / Add pet. The wizard collects a photo and details.',
    },
    tips: {
      fa: 'عکس پت ممکن است برای تأیید ادمین در صف بماند؛ تا تأیید، نمایش عمومی محدود است.',
      en: 'A pet photo may wait in the admin queue; public display is limited until approved.',
    },
    botLabel: 'پت‌های من',
    sitePath: '/my-pets',
  },
  {
    id: 'diary',
    section: 'diary',
    audiences: ['pet_owner'],
    surfaces: ['web'],
    title: { fa: 'دفتر خاطرات پت', en: 'Pet diary' },
    what: {
      fa: 'یادداشت‌های روزانه پت روی صفحه پت. خواندن برای بازدیدکنندگان صفحه عمومی ممکن است؛ نوشتن فقط برای صاحب است.',
      en: 'Daily notes on the pet page. The public pet page can be read; only the owner can write.',
    },
    how: {
      fa: 'از پت‌های من «خاطرات» را بزن یا در پروفایل پت به دفتر خاطرات برو. متن را بنویس و ثبت کن؛ حذف فقط برای صاحب است.',
      en: 'From My pets open Diary, or scroll to the diary on the pet profile. Write an entry; only the owner can delete.',
    },
    tips: {
      fa: 'دفتر خاطرات فعلاً در ربات نیست؛ از سایت استفاده کن. پرونده پزشکی همان صفحه پت است.',
      en: 'The diary is on the site, not in the bot. The medical record is on the same pet page.',
    },
    sitePath: '/my-pets',
  },
  {
    id: 'medical',
    section: 'pets',
    audiences: ['pet_owner'],
    surfaces: ['web'],
    title: { fa: 'پرونده پزشکی پت', en: 'Pet medical record' },
    what: {
      fa: 'یادداشت‌های سلامت پت (واکسن، بیماری و …) روی پروفایل پت در سایت — جدا از چت دامپزشک.',
      en: 'Health notes (vaccines, conditions, and so on) on the site pet profile — separate from vet chat.',
    },
    how: {
      fa: 'پروفایل پت را باز کن و بخش پرونده پزشکی را ببین یا ویرایش کن.',
      en: 'Open the pet profile and view or edit the medical record section.',
    },
    tips: {
      fa: 'مشاوره دامپزشک جایگزین مراجعه حضوری در موارد اورژانس نیست.',
      en: 'An online consult does not replace an in-person visit in an emergency.',
    },
    sitePath: '/my-pets',
  },
  {
    id: 'wallet',
    section: 'wallet',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'کیف پول و سکه', en: 'Wallet & coins' },
    what: {
      fa: `کیف پول چندارزی مشترک: سکه، تومان، ستاره تلگرام و TON. هدیه ثبت‌نام ${FA_SIGNUP} سکه است.`,
      en: `Shared multi-currency wallet: coins, toman, Telegram Stars, and TON. Signup bonus is ${SIGNUP_BONUS} coins.`,
    },
    how: {
      fa: 'ربات: منوی سکه — بسته بخر (ستاره‌ها یا کارت‌به‌کارت با رسید)، سکه روزانه، تراکنش‌ها. سایت: کیف پول — موجودی، رسید کارت‌به‌کارت، همگام‌سازی ستاره با ربات.',
      en: 'Bot: Coins menu — buy a pack (Stars or card-to-card receipt), daily coins, transactions. Site: Wallet — balances, card receipt upload, Stars sync via the bot.',
    },
    tips: {
      fa: 'رسید کارت‌به‌کارت بعد از تأیید ادمین در لجر می‌نشیند. برای فاکتور ستاره باید حساب وب به ربات وصل باشد.',
      en: 'Card-to-card credit lands after admin approval. Stars invoices need the web account linked to the bot.',
    },
    botLabel: 'سکه',
    sitePath: '/wallet',
  },
  {
    id: 'earn',
    section: 'wallet',
    audiences: ['pet_owner'],
    surfaces: ['bot', 'web'],
    title: { fa: 'کسب درآمد', en: 'Earn / withdraw' },
    what: {
      fa: 'صاحب پت می‌تواند سکه بفروشد / برداشت را از مسیر کسب درآمد ثبت کند.',
      en: 'Pet owners can sell coins / request a payout from the earn flow.',
    },
    how: {
      fa: 'ربات: «کسب درآمد». سایت: کیف پول → کسب درآمد / برداشت. مبلغ را تأیید کن و منتظر بررسی ادمین بمان.',
      en: 'Bot: Earn. Site: Wallet → Earn / withdraw. Confirm the amount and wait for admin review.',
    },
    tips: {
      fa: 'موجودی باید کافی باشد؛ وضعیت درخواست در همان بخش دیده می‌شود.',
      en: 'You need enough balance; request status stays on that screen.',
    },
    botLabel: 'کسب درآمد',
    sitePath: '/wallet/earn',
  },
  {
    id: 'shop',
    section: 'shop',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'پت‌شاپ', en: 'Pet shop' },
    what: {
      fa: 'خرید غذا و لوازم پت با قیمت تومان. کاتالوگ برای مهمان باز است؛ ثبت سفارش ورود می‌خواهد.',
      en: 'Buy pet food and supplies in toman. The catalog is public; checkout needs login.',
    },
    how: {
      fa: 'دسته و فیلتر را انتخاب کن، کالا را به سبد ببر. پرداخت: سکه، ستاره کیف پول، ستاره تلگرام، تومان یا کارت‌به‌کارت — همان مسیر ربات و سایت.',
      en: 'Pick a category and filters, add to cart. Pay with coins, wallet Stars, Telegram Stars, toman, or card-to-card — same path on bot and site.',
    },
    tips: {
      fa: 'سفارش‌ها در شاپ → سفارش‌های من می‌ماند. اگر پرداخت ستاره است، حساب را به ربات وصل کن.',
      en: 'Orders stay under Shop → My orders. For Stars payment, link the account to the bot.',
    },
    botLabel: 'پت‌شاپ',
    sitePath: '/shop',
  },
  {
    id: 'invite',
    section: 'invite',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'دعوت دوستان', en: 'Invite friends' },
    what: {
      fa: `با لینک دعوت اختصاصی، به‌ازای هر ثبت‌نام جدید ${FA_REFERRAL} سکه می‌گیری.`,
      en: `Your invite link pays ${REFERRAL_BONUS_COINS} coins for each new signup.`,
    },
    how: {
      fa: 'ربات: «دعوت دوستان» یا دکمه دعوت در سکه. سایت: صفحه دعوت، کارت دعوت در خانه و کیف پول. لینک را کپی یا در تلگرام به اشتراک بگذار.',
      en: 'Bot: Invite friends or the invite button in Coins. Site: /invite, plus the invite card on Home and Wallet. Copy the link or share it in Telegram.',
    },
    tips: {
      fa: 'جایزه وقتی می‌نشیند که دوست با همان لینک ثبت‌نام کند — لینک را عوض نکن.',
      en: 'The bonus lands when a friend signs up with that exact link — do not edit it.',
    },
    botLabel: 'دعوت دوستان',
    sitePath: '/invite',
  },
  {
    id: 'face',
    section: 'verify',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'احراز چهره', en: 'Face verification' },
    what: {
      fa: `سلفی واضح برای تأیید هویت پروفایل. بعد از تأیید ادمین ${FA_FACE} سکه جایزه است.`,
      en: `A clear selfie for profile identity. After admin approval you get ${FACE_VERIFY_REWARD} coins.`,
    },
    how: {
      fa: 'ربات: «احراز چهره» و سلفی یا ویدیوی کوتاه بفرست. سایت: پروفایل → احراز. وضعیت: در انتظار / تأیید / رد.',
      en: 'Bot: Face verify, then send a selfie or short video. Site: Profile → Verify. Status: pending / verified / rejected.',
    },
    tips: {
      fa: 'عکس باید با چهره خودت یکی باشد. رد شدن معمولاً با توضیح در همان بخش است.',
      en: 'The photo must match your face. A rejection usually includes a note in the same panel.',
    },
    botLabel: 'احراز چهره',
    sitePath: '/profile?panel=verify',
  },
  {
    id: 'phone',
    section: 'verify',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'احراز موبایل', en: 'Phone verification' },
    what: {
      fa: 'تأیید شماره ایران با کد پیامک. برای دامپزشک اجباری است؛ برای بقیه پیشنهادی است.',
      en: 'Confirm an Iranian number with an SMS code. Required for vets; optional for others.',
    },
    how: {
      fa: 'ربات: «احراز موبایل» یا ارسال شماره تماس. سایت: ورود OTP همان شماره را روی حساب می‌گذارد.',
      en: 'Bot: Phone verify or share contact. Site: OTP login attaches that number to the account.',
    },
    tips: {
      fa: 'اگر کد نیامد چند دقیقه صبر کن و دوباره بفرست؛ پیش‌شماره را درست وارد کن.',
      en: 'If the code does not arrive, wait a few minutes and retry with the correct prefix.',
    },
    botLabel: 'احراز موبایل',
    sitePath: '/auth/login',
  },
  {
    id: 'vetq',
    section: 'consults',
    audiences: ['pet_owner'],
    surfaces: ['bot', 'web'],
    title: { fa: 'مشاوره سریع دامپزشک', en: 'Quick vet consult' },
    what: {
      fa: 'اتصال به دامپزشک آنلاین برای چت مشاوره. هزینه از سکه کیف پول کم می‌شود؛ مبلغ ویزیت را پزشک تنظیم می‌کند.',
      en: 'Connect to an online vet for consult chat. Coins are charged from the wallet; the vet sets the visit fee.',
    },
    how: {
      fa: `ربات: «مشاوره سریع پزشک». سایت: مشاوره سریع / دامپزشک. اگر پزشکی آنلاین باشد درخواست می‌رود؛ وگرنه منتظر بمان یا بعداً دوباره بزن. حداقل تعرفه ${FA_VET_MIN} سکه است.`,
      en: `Bot: Quick vet. Site: Quick consult / Vet. If a vet is online the request is sent; otherwise wait and retry. Minimum fee is ${QUICK_VET_COST} coin.`,
    },
    tips: {
      fa: 'این مشاوره آنلاین است، نه نسخه حضوری اورژانس. اگر علائم شدید دیدی به کلینیک مراجعه کن.',
      en: 'This is an online consult, not an emergency clinic visit. Go in person if signs are severe.',
    },
    botLabel: 'مشاوره پزشک',
    sitePath: '/vet-consult',
  },
  {
    id: 'trainerq',
    section: 'consults',
    audiences: ['pet_owner'],
    surfaces: ['bot', 'web'],
    title: { fa: 'درخواست مربی', en: 'Request a trainer' },
    what: {
      fa: `آموزش رفتار و فرمان‌پذیری با مربی تأییدشده. هزینه ${FA_TRAINER} سکه است.`,
      en: `Behavior and cue coaching with a verified trainer. Cost is ${TRAINER_CONSULT_COST} coins.`,
    },
    how: {
      fa: 'ربات: «درخواست مربی». سایت: پیدا کردن مربی. درخواست به مربی آنلاین می‌رود؛ بعد از پذیرش چت آموزش باز می‌شود.',
      en: 'Bot: Request trainer. Site: Find a trainer. The request goes to an online trainer; coaching chat opens after accept.',
    },
    tips: {
      fa: 'اگر مربی آنلاین نباشد اتصال برقرار نمی‌شود؛ بعداً دوباره تلاش کن.',
      en: 'If no trainer is online, the connect will not start — try again later.',
    },
    botLabel: 'درخواست مربی',
    sitePath: '/trainer-consult',
  },
  {
    id: 'vetonline',
    section: 'consults',
    audiences: ['vet'],
    surfaces: ['bot', 'web'],
    title: { fa: 'آنلاین / آفلاین دامپزشک', en: 'Vet online / offline' },
    what: {
      fa: 'با آنلاین شدن در لیست پزشک‌های آماده پذیرش قرار می‌گیری؛ آفلاین درخواست جدید نمی‌آید.',
      en: 'Going online lists you as available; offline stops new requests.',
    },
    how: {
      fa: 'در ربات دکمه‌های آنلاین / آفلاین را بزن. در سایت از پنل پزشک وضعیت را ببین و درخواست‌ها را بپذیر.',
      en: 'Use the bot Online / Offline buttons. On the site, manage incoming requests from the vet panel.',
    },
    tips: {
      fa: 'مدرک تأییدنشده ممکن است پذیرش را محدود کند. احراز موبایل را کامل کن.',
      en: 'An unverified credential may limit intake. Finish phone verification.',
    },
    botLabel: 'آنلاین/آفلاین',
    sitePath: '/vet-consult',
  },
  {
    id: 'patients',
    section: 'consults',
    audiences: ['vet'],
    surfaces: ['bot', 'web'],
    title: { fa: 'بیماران اخیر', en: 'Recent patients' },
    what: {
      fa: 'فهرست مشاوره‌های اخیر برای برگشتن به چت یا دیدن وضعیت.',
      en: 'Recent consults so you can reopen chat or check status.',
    },
    how: {
      fa: 'ربات: «بیماران اخیر». سایت: گفتگوهای پزشک یا پنل دامپزشک.',
      en: 'Bot: Recent patients. Site: vet chats or the vet panel.',
    },
    tips: {
      fa: 'پیشنهاد دارو در چت فقط راهنما است؛ دوز را خودت کامل کن.',
      en: 'In-chat drug suggestions are hints only — you complete dose and duration.',
    },
    botLabel: 'بیماران اخیر',
    sitePath: '/chats',
  },
  {
    id: 'vetfee',
    section: 'consults',
    audiences: ['vet'],
    surfaces: ['bot'],
    title: { fa: 'تعرفه ویزیت', en: 'Visit fee' },
    what: {
      fa: 'مبلغ ویزیت به سکه را خودت تنظیم می‌کنی؛ از صاحب پت همان مبلغ کم می‌شود.',
      en: 'You set the visit fee in coins; that amount is charged to the pet owner.',
    },
    how: {
      fa: '«تعرفه ویزیت» را بزن و یکی از مبالغ آماده یا مبلغ سفارشی را بفرست.',
      en: 'Tap Visit fee and pick a preset or enter a custom amount.',
    },
    tips: {
      fa: `حداقل ${FA_VET_MIN} سکه است. تعرفه خیلی بالا ممکن است درخواست را کم کند.`,
      en: `Minimum is ${QUICK_VET_COST} coin. A very high fee may reduce requests.`,
    },
    botLabel: 'تعرفه ویزیت',
  },
  {
    id: 'tronline',
    section: 'consults',
    audiences: ['trainer'],
    surfaces: ['bot', 'web'],
    title: { fa: 'آنلاین / آفلاین مربی', en: 'Trainer online / offline' },
    what: {
      fa: 'آنلاین شدن تو را در لیست مربیان آماده می‌گذارد؛ آفلاین درخواست جدید نمی‌آید.',
      en: 'Going online lists you as available; offline stops new requests.',
    },
    how: {
      fa: 'دکمه‌های آنلاین / آفلاین مربی در ربات، یا پنل مربی در سایت.',
      en: 'Use the trainer Online / Offline bot buttons, or the site trainer panel.',
    },
    tips: {
      fa: 'اول مدرک مربی را بفرست تا ادمین تأیید کند.',
      en: 'Upload your trainer credential first so admin can verify it.',
    },
    botLabel: 'آنلاین مربی',
    sitePath: '/trainer-consult',
  },
  {
    id: 'clients',
    section: 'consults',
    audiences: ['trainer'],
    surfaces: ['bot', 'web'],
    title: { fa: 'مراجعان اخیر', en: 'Recent clients' },
    what: {
      fa: 'مشاوره‌های آموزشی اخیر برای ادامه چت.',
      en: 'Recent coaching consults so you can continue the chat.',
    },
    how: {
      fa: 'ربات: «مراجعان اخیر». سایت: گفتگوهای مربی.',
      en: 'Bot: Recent clients. Site: trainer chats.',
    },
    botLabel: 'مراجعان اخیر',
    sitePath: '/chats',
  },
  {
    id: 'trcred',
    section: 'consults',
    audiences: ['trainer'],
    surfaces: ['bot', 'web'],
    title: { fa: 'مدرک مربی', en: 'Trainer credential' },
    what: {
      fa: 'تصویر مدرک یا گواهی مربی برای بررسی ادمین.',
      en: 'A photo of your trainer certificate for admin review.',
    },
    how: {
      fa: 'ربات: «آپلود مدرک مربی». سایت: از پروفایل / پنل مربی مدرک را بفرست و وضعیت را ببین.',
      en: 'Bot: Upload trainer credential. Site: send it from Profile / trainer panel and check status.',
    },
    tips: {
      fa: 'تا تأیید، نمایش عمومی به‌عنوان مربی تأییدشده محدود است.',
      en: 'Until approved, you may not appear as a verified trainer.',
    },
    botLabel: 'مدرک مربی',
    sitePath: '/profile',
  },
  {
    id: 'seeker',
    section: 'consults',
    audiences: ['pet_owner'],
    surfaces: ['bot', 'web'],
    title: { fa: 'پذیرش مشورت با صاحبین', en: 'Accept owner-advice requests' },
    what: {
      fa: `صاحب پت می‌تواند درخواست مشورت از نقش بدون پت را بپذیرد. سهم صاحب ${FA_SEEKER_SHARE} سکه از هزینه ${FA_SEEKER} سکه‌ای است.`,
      en: `Pet owners can accept advice requests from no-pet users. The owner share is ${SEEKER_OWNER_SHARE} of the ${SEEKER_ADVICE_COST}-coin fee.`,
    },
    how: {
      fa: 'در ربات سوییچ «پذیرش مشورت با صاحبین» را روشن کن. درخواست در چت/اعلان می‌آید؛ بپذیر یا رد کن.',
      en: 'Turn on Accept owner advice in the bot. The request arrives as a chat/notification; accept or decline.',
    },
    tips: {
      fa: 'اگر نمی‌خواهی درخواست بیاید سوییچ را خاموش بگذار.',
      en: 'Leave the switch off if you do not want these requests.',
    },
    botLabel: 'مشورت صاحبین',
    sitePath: '/chats',
  },
  {
    id: 'owneradv',
    section: 'consults',
    audiences: ['no_pet', 'guest'],
    surfaces: ['bot', 'web'],
    title: { fa: 'مشورت با صاحبین', en: 'Ask pet owners' },
    what: {
      fa: `کاربر بدون پت می‌تواند از صاحب پت درباره خرید و نگهداری بپرسد. هزینه ${FA_SEEKER} سکه است.`,
      en: `No-pet users can ask an owner about buying and keeping a pet. Cost is ${SEEKER_ADVICE_COST} coins.`,
    },
    how: {
      fa: 'ربات: «مشورت با صاحبین». سایت: از گفتگوها / مسیر بدون پت درخواست بده. صاحب باید پذیرش مشورت را روشن کرده باشد.',
      en: 'Bot: Ask owners. Site: start from Chats / no-pet flow. The owner must have advice intake enabled.',
    },
    tips: {
      fa: 'اگر گفتگو خیلی زود قطع شود کل هزینه برمی‌گردد. این مشاوره پزشکی نیست.',
      en: 'If the chat ends almost immediately, the full fee is refunded. This is not a medical consult.',
    },
    botLabel: 'مشورت با صاحبین',
    sitePath: '/chats',
  },
  {
    id: 'games',
    section: 'games',
    audiences: ['all'],
    surfaces: ['web'],
    title: { fa: 'بازی‌ها', en: 'Games' },
    what: {
      fa: 'بازی‌های گروهی زمان‌بندی‌شده (فوتبال، فکری و …) روی سایت — جدا از همبازی پت.',
      en: 'Scheduled group games (football, board games, and more) on the site — not the same as pet playmates.',
    },
    how: {
      fa: 'صفحه بازی‌ها را باز کن، فیلتر وضعیت را بزن، عضو شو یا بازی بساز. ساختن و پیوستن ورود می‌خواهد.',
      en: 'Open Games, filter by status, join or create. Creating and joining require login.',
    },
    tips: {
      fa: 'این بخش در ربات نیست. همبازی پت از مسیر «هم بازی» است نه اینجا.',
      en: 'Games are site-only. Pet playmates live under Playmates, not here.',
    },
    sitePath: '/games',
  },
  {
    id: 'adopt',
    section: 'adoption',
    audiences: ['all'],
    surfaces: ['web'],
    title: { fa: 'پذیرش پت', en: 'Adoption' },
    what: {
      fa: 'فهرست پت‌های نیازمند خانه روی سایت. جزئیات هر پت را بدون ورود می‌بینی.',
      en: 'A public list of pets that need a home. You can read each profile without logging in.',
    },
    how: {
      fa: 'از پذیرش، کارت پت را باز کن. برای اقدام بعدی وارد شو تا از حساب پت‌دیت پیگیری شود.',
      en: 'Open a pet card from Adoption. Sign in to continue so follow-up stays on your PetDate account.',
    },
    tips: {
      fa: 'پذیرش مسئولانه است؛ بازدید حضوری را خودتان هماهنگ کنید. ربات فهرست پذیرش جدا ندارد.',
      en: 'Adoption is meant to be responsible; arrange an in-person visit yourselves. The bot has no separate adoption list.',
    },
    sitePath: '/adoption',
  },
  {
    id: 'mag',
    section: 'magazine',
    audiences: ['all'],
    surfaces: ['web'],
    title: { fa: 'مجله', en: 'Magazine' },
    what: {
      fa: 'مقالات مراقبت، تغذیه و سلامت پت — برای همه باز است.',
      en: 'Care, feeding, and health articles — public.',
    },
    how: {
      fa: 'از مجله یا اخبار لندینگ یک مطلب را باز کن. ورود لازم نیست.',
      en: 'Open an article from Magazine or the landing news block. No login required.',
    },
    sitePath: '/magazine',
  },
  {
    id: 'support',
    section: 'support',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'پشتیبانی', en: 'Support' },
    what: {
      fa: 'پشتیبانی پت‌دیت برای ورود، پت، همبازی، مربی، دامپزشک، شاپ و سکه. در سایت تیکت انسانی یا گفتگو با بات پشتیبانی داری؛ در ربات همان دکمهٔ پشتیبانی.',
      en: 'PetDate support for login, pets, playmates, trainer, vet, shop, and coins. On the site you can open a human ticket or chat with the support bot; in Telegram use Support.',
    },
    how: {
      fa: 'ربات: «پشتیبانی». سایت: پشتیبانی — تیکت ثبت کن یا با بات پشتیبانی حرف بزن. سؤال را کوتاه بنویس.',
      en: 'Bot: Support. Site: Support — file a ticket or chat with the support bot. Keep the question short.',
    },
    tips: {
      fa: 'برای مشکل OTP شماره را با پیش‌شماره درست دوباره امتحان کن؛ اگر ادامه داشت همین‌جا پیام بگذار.',
      en: 'For OTP issues retry with the correct prefix; if it continues, write here.',
    },
    botLabel: 'پشتیبانی',
    sitePath: '/support',
  },
  {
    id: 'profile',
    section: 'profile',
    audiences: ['all'],
    surfaces: ['bot', 'web'],
    title: { fa: 'پروفایل', en: 'Profile' },
    what: {
      fa: 'نام، سن، شهر، عکس، بیو و علایق صاحب — جدا از پروفایل پت. تکمیل بخش‌ها سکه جایزه دارد.',
      en: 'Owner name, age, city, photo, bio, and interests — separate from the pet profile. Completing sections awards coins.',
    },
    how: {
      fa: 'ربات: «پروفایل» یا /profile. سایت: پروفایل و منوی مدیریت (ویرایش، احراز، تعاملات، بلاک، حساب).',
      en: 'Bot: Profile or /profile. Site: Profile and the manage menu (edit, verify, interactions, blocked, account).',
    },
    tips: {
      fa: 'عکس پروفایل هم ممکن است نیاز به تأیید ادمین داشته باشد.',
      en: 'Your avatar may also need admin approval.',
    },
    botLabel: 'پروفایل',
    sitePath: '/profile',
  },
];

export const HELP_FAQ: HelpFaqItem[] = [
  {
    id: 'what-is',
    q: {
      fa: 'پت‌دیت چیست و برای چه کسانی است؟',
      en: 'What is PetDate and who is it for?',
    },
    a: {
      fa: HELP_ROLE_INTROS.guest.what.fa,
      en: HELP_ROLE_INTROS.guest.what.en,
    },
  },
  {
    id: 'same-account',
    q: {
      fa: 'آیا حساب وب و ربات تلگرام یکی است؟',
      en: 'Are the web and Telegram bot accounts the same?',
    },
    a: {
      fa: 'بله. با همان موبایل وارد می‌شوی؛ پت‌ها، درخواست‌ها، گفتگوها، سفارش‌ها و کیف پول روی دیتابیس مشترک می‌مانند.',
      en: 'Yes. Sign in with the same mobile; pets, requests, chats, orders, and wallet stay on one shared database.',
    },
  },
  {
    id: 'guest-login',
    q: {
      fa: 'برای دیدن سایت باید وارد شوم؟',
      en: 'Do I need to log in to browse the site?',
    },
    a: {
      fa: 'خیر. لندینگ، شاپ، مجله، پذیرش، بازی‌ها و صفحه دامپزشک باز است. برای همبازی، ثبت پت، چت، کیف پول و ثبت سفارش با OTP یا تلگرام وارد شو.',
      en: 'No. Landing, shop, magazine, adoption, games, and the vet page are open. Sign in with OTP or Telegram for playmates, pets, chat, wallet, and checkout.',
    },
  },
  {
    id: 'cross-surface',
    q: {
      fa: 'اگر من وب باشم و طرف مقابل ربات؟',
      en: 'What if I am on web and the other person is on the bot?',
    },
    a: {
      fa: 'پیام و درخواست از API مشترک رد می‌شود؛ هر دو طرف همان مکالمه را می‌بینند.',
      en: 'Messages and requests go through the shared API; both sides see the same conversation.',
    },
  },
  {
    id: 'roles-q',
    q: {
      fa: 'چه نقش‌هایی وجود دارد؟',
      en: 'Which roles exist?',
    },
    a: {
      fa: 'صاحب پت، دامپزشک، مربی و بدون پت. مهمان هم می‌تواند بخش‌های عمومی را ببیند. نقش فعال، منوی ربات و پنل سایت را عوض می‌کند.',
      en: 'Pet owner, vet, trainer, and no-pet. Guests can still browse public sections. The active role changes the bot menu and site panel.',
    },
  },
  {
    id: 'playmate-q',
    q: {
      fa: 'همبازی پت چطور کار می‌کند؟',
      en: 'How do playmates work?',
    },
    a: {
      fa: `پت را ثبت کن، از هم بازی یا «پیدا کردن همبازی» درخواست بفرست (هزینه ${FA_PLAYDATE} سکه). بعد از پذیرش چت باز می‌شود و می‌توانید قرار را هماهنگ کنید.`,
      en: `Register a pet, send a request from Playmates or Find a playmate (${PLAYDATE_REQUEST_COST} coins). Chat opens after accept so you can arrange a meetup.`,
    },
  },
  {
    id: 'add-pet-q',
    q: {
      fa: 'چطور پت جدید اضافه کنم؟',
      en: 'How do I add a pet?',
    },
    a: {
      fa: 'با نقش صاحب پت، از پت‌های من یا ثبت پت عکس و مشخصات را پر کن. دفتر خاطرات و پرونده پزشکی روی همان پت در سایت است.',
      en: 'As a pet owner, use My pets or Add pet and fill photo plus details. Diary and medical record live on that pet on the site.',
    },
  },
  {
    id: 'diary-q',
    q: {
      fa: 'دفتر خاطرات پت کجاست؟',
      en: 'Where is the pet diary?',
    },
    a: {
      fa: 'فقط روی سایت: از پت‌های من وارد پروفایل پت شو و دفتر خاطرات را باز کن. نوشتن مال صاحب است؛ ربات این بخش را ندارد.',
      en: 'Site only: open the pet profile from My pets and use the diary. Only the owner can write; the bot does not have this section.',
    },
  },
  {
    id: 'wallet-q',
    q: {
      fa: 'کیف پول و سکه چطور شارژ می‌شود؟',
      en: 'How do I top up wallet and coins?',
    },
    a: {
      fa: `سکه، تومان، ستاره و TON مشترک وب و ربات است. در ربات از منوی سکه بسته بخر یا سکه روزانه بگیر؛ در سایت رسید کارت‌به‌کارت آپلود کن. دعوت دوست ${FA_REFERRAL} سکه است.`,
      en: `Coins, toman, Stars, and TON are shared. Buy a pack or claim daily coins in the bot; upload a card receipt on the site. An invite pays ${REFERRAL_BONUS_COINS} coins.`,
    },
  },
  {
    id: 'shop-q',
    q: {
      fa: 'خرید از پت‌شاپ چگونه است؟',
      en: 'How does the pet shop work?',
    },
    a: {
      fa: 'دسته و فیلتر را انتخاب کن، کالا را به سبد ببر و با ورود سفارش بده. پرداخت با سکه، ستاره، تومان یا کارت‌به‌کارت است.',
      en: 'Pick a category and filters, add to cart, and check out after login. Pay with coins, Stars, toman, or card-to-card.',
    },
  },
  {
    id: 'vet-q',
    q: {
      fa: 'مشاوره دامپزشک آنلاین دارید؟',
      en: 'Do you have online vet consults?',
    },
    a: {
      fa: 'بله. صاحب پت از مشاوره سریع درخواست می‌دهد؛ دامپزشک آنلاین می‌پذیرد. چت روی وب و ربات یکی است. هزینه از سکه است.',
      en: 'Yes. Pet owners send a quick-consult request; an online vet accepts. Chat is the same on web and bot. Payment is in coins.',
    },
  },
  {
    id: 'trainer-q',
    q: {
      fa: 'مربی پت چطور کار می‌کند؟',
      en: 'How does the trainer flow work?',
    },
    a: {
      fa: `صاحب پت درخواست مربی می‌فرستد ( ${FA_TRAINER} سکه ). مربی باید آنلاین و مدرکش در صف/تأیید باشد. چت آموزش مشترک است.`,
      en: `A pet owner requests a trainer (${TRAINER_CONSULT_COST} coins). The trainer must be online with a credential in review or verified. Coaching chat is shared.`,
    },
  },
  {
    id: 'nopet-q',
    q: {
      fa: 'اگر هنوز پت نداشته باشم چه کار کنم؟',
      en: 'What if I do not have a pet yet?',
    },
    a: {
      fa: `نقش بدون پت را بگیر، از مشورت با صاحبین استفاده کن ( ${FA_SEEKER} سکه )، پذیرش و شاپ را ببین. بعداً نقش صاحب پت را اضافه کن.`,
      en: `Choose no-pet, ask owners (${SEEKER_ADVICE_COST} coins), and browse adoption and shop. Add the pet-owner role later.`,
    },
  },
  {
    id: 'games-q',
    q: {
      fa: 'بازی‌ها با همبازی پت فرق دارد؟',
      en: 'Are Games different from pet playmates?',
    },
    a: {
      fa: 'بله. بازی‌ها رویداد گروهی روی سایت است (فوتبال، فکری و …). همبازی پت برای قرار دو پت است و از مسیر هم بازی / ربات است.',
      en: 'Yes. Games are scheduled group events on the site. Playmates are one-to-one pet meetups via Playmates / the bot.',
    },
  },
  {
    id: 'adopt-q',
    q: {
      fa: 'بخش پذیرش پت چه کاربردی دارد؟',
      en: 'What is the adoption section for?',
    },
    a: {
      fa: 'پت‌های نیازمند خانه را نشان می‌دهد. جزئیات را ببین و برای ادامه وارد شو تا ارتباط روی حساب پت‌دیت بماند.',
      en: 'It lists pets that need a home. Read the details and sign in to continue so contact stays on your PetDate account.',
    },
  },
  {
    id: 'invite-q',
    q: {
      fa: 'دعوت دوستان چه جایزه‌ای دارد؟',
      en: 'What is the invite reward?',
    },
    a: {
      fa: `لینک دعوت را از ربات، صفحه دعوت، خانه یا کیف پول بگیر. با هر ثبت‌نام از آن لینک ${FA_REFERRAL} سکه به موجودی‌ات اضافه می‌شود.`,
      en: `Get your invite link from the bot, /invite, Home, or Wallet. Each signup from that link adds ${REFERRAL_BONUS_COINS} coins.`,
    },
  },
  {
    id: 'verify-q',
    q: {
      fa: 'احراز چهره و موبایل برای چیست؟',
      en: 'What are face and phone verification for?',
    },
    a: {
      fa: `احراز چهره با سلفی و تأیید ادمین است (جایزه ${FA_FACE} سکه). احراز موبایل با پیامک است و برای دامپزشک اجباری است.`,
      en: `Face verify is a selfie reviewed by admin (${FACE_VERIFY_REWARD} coin bonus). Phone verify uses SMS and is required for vets.`,
    },
  },
  {
    id: 'otp-q',
    q: {
      fa: 'اگر کد OTP نیامد چه کنم؟',
      en: 'What if the OTP code does not arrive?',
    },
    a: {
      fa: 'شماره را با پیش‌شماره درست وارد کن، چند دقیقه صبر کن و دوباره بفرست. اگر ادامه داشت از پشتیبانی سایت یا ربات پیام بگذار.',
      en: 'Enter the number with the correct prefix, wait a few minutes, and retry. If it continues, write to Support on the site or bot.',
    },
  },
  {
    id: 'privacy-q',
    q: {
      fa: 'اطلاعات و پیام‌های من چقدر امن است؟',
      en: 'How safe are my data and messages?',
    },
    a: {
      fa: 'ورود با OTP است. داده پت، چت و سفارش روی سرور پروژه می‌ماند. کاربران عادی رمز ثابت ندارند؛ پنل ادمین جدا است. چت امن را می‌توانی پاک کنی.',
      en: 'Login is OTP. Pet, chat, and order data stay on the project server. Regular users have no standing password; admin is separate. You can wipe a secure chat.',
    },
  },
];

export const HELP_AUDIENCES: HelpAudience[] = ['guest', ...USER_ROLES];

export const TELEGRAM_HELP_LIMIT = 4096;

export function helpAudienceForUser(
  user: { roles?: UserRole[] | null; role?: UserRole | null } | null | undefined
): HelpAudience {
  if (!user) return 'guest';
  return primaryRole(user.roles, user.role) ?? 'guest';
}

export function helpTopicById(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.id === id);
}

export function topicsForAudience(audience: HelpAudience, surface?: HelpSurface): HelpTopic[] {
  return HELP_TOPICS.filter((t) => {
    const audOk = t.audiences.includes('all') || t.audiences.includes(audience);
    const surfOk = !surface || t.surfaces.includes(surface);
    return audOk && surfOk;
  });
}

export function botHelpTopicButtons(audience: HelpAudience): Array<{ id: string; label: string }> {
  return topicsForAudience(audience, 'bot')
    .filter((t) => t.botLabel)
    .map((t) => ({ id: t.id, label: t.botLabel as string }));
}

function pick(text: LocalizedHelp, lang: HelpLang): string {
  return text[lang];
}

function topicLine(topic: HelpTopic, lang: HelpLang): string {
  const one = pick(topic.what, lang).split(/(?<=[.؟!])\s+/)[0] ?? pick(topic.what, lang);
  return lang === 'fa'
    ? `• <b>${esc(pick(topic.title, lang))}</b> — ${esc(one)}`
    : `• <b>${esc(pick(topic.title, lang))}</b> — ${esc(one)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatHelpArticle(topic: HelpTopic, lang: HelpLang = 'fa'): string {
  const L = HELP_STRUCTURE;
  const lines = [
    `<b>${esc(pick(topic.title, lang))}</b>`,
    '',
    `<b>${esc(pick(L.what, lang))}</b>`,
    esc(pick(topic.what, lang)),
    '',
    `<b>${esc(pick(L.how, lang))}</b>`,
    esc(pick(topic.how, lang)),
  ];
  if (topic.tips) {
    lines.push('', `<b>${esc(pick(L.tips, lang))}</b>`, esc(pick(topic.tips, lang)));
  }
  return lines.join('\n');
}

export function formatBotHelpOverview(audience: HelpAudience): string {
  const intro = HELP_ROLE_INTROS[audience];
  const L = HELP_STRUCTURE;
  const topics = topicsForAudience(audience, 'bot');
  const commands = [
    '/start — شروع یا بازگشت به منو',
    '/menu — نمایش منو',
    '/help — راهنمای همین نقش',
    '/cancel — لغو عملیات جاری',
    '/profile — پروفایل',
  ];
  const lines = [
    `🐾 <b>${esc(intro.title.fa)}</b>`,
    `<i>${esc(BRAND.taglineEn)}</i>`,
    '',
    `<b>${esc(L.what.fa)}</b>`,
    esc(intro.what.fa),
    '',
    `<b>${esc(L.how.fa)}</b>`,
    esc(intro.how.fa),
    '',
    '<b>بخش‌های همین نقش</b>',
    ...topics.slice(0, 12).map((t) => topicLine(t, 'fa')),
    '',
    '<b>دستورها</b>',
    ...commands,
    '',
    `<b>${esc(L.tips.fa)}</b>`,
    esc(intro.tips.fa),
    '',
    'جزئیات هر بخش را از دکمه‌های زیر باز کن.',
  ];
  return lines.join('\n');
}

export function formatBotHelpTopic(topicId: string): string | null {
  const topic = helpTopicById(topicId);
  if (!topic) return null;
  return formatHelpArticle(topic, 'fa');
}

export function siteFaqItems(lang: HelpLang): Array<{ id: string; q: string; a: string }> {
  return HELP_FAQ.map((item) => ({
    id: item.id,
    q: pick(item.q, lang),
    a: pick(item.a, lang),
  }));
}

export function siteRoleGuides(lang: HelpLang): Array<{
  id: HelpAudience;
  title: string;
  what: string;
  how: string;
  tips: string;
}> {
  return HELP_AUDIENCES.map((id) => ({
    id,
    title: pick(HELP_ROLE_INTROS[id].title, lang),
    what: pick(HELP_ROLE_INTROS[id].what, lang),
    how: pick(HELP_ROLE_INTROS[id].how, lang),
    tips: pick(HELP_ROLE_INTROS[id].tips, lang),
  }));
}

export function siteHelpSections(lang: HelpLang): Array<{
  id: HelpSectionId;
  title: string;
  topics: Array<{
    id: string;
    title: string;
    what: string;
    how: string;
    tips?: string;
    sitePath?: string;
  }>;
}> {
  const order: HelpSectionId[] = [
    'account',
    'roles',
    'playmates',
    'chats',
    'pets',
    'diary',
    'wallet',
    'shop',
    'invite',
    'verify',
    'consults',
    'games',
    'adoption',
    'magazine',
    'support',
    'profile',
  ];
  return order
    .map((id) => ({
      id,
      title: pick(HELP_SECTION_LABELS[id], lang),
      topics: HELP_TOPICS.filter((t) => t.section === id).map((t) => ({
        id: t.id,
        title: pick(t.title, lang),
        what: pick(t.what, lang),
        how: pick(t.how, lang),
        tips: t.tips ? pick(t.tips, lang) : undefined,
        sitePath: t.sitePath,
      })),
    }))
    .filter((s) => s.topics.length > 0);
}

/** Landing-page short FAQ — same facts as HELP_FAQ, existing i18n keys. */
export const LANDING_FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4'] as const;
