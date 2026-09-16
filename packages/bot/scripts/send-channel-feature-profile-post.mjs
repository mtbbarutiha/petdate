import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

const chatId = process.env.CHANNEL || '@petdating';
const photoPath =
  process.env.PHOTO ||
  path.join(
    __dirname,
    '../assets/channel-posts/petdate-channel-post-profile-coins.jpg'
  );
const botUrl = process.env.BOT_URL || 'https://t.me/Petdatebot?start=channel';

const caption = [
  '🛒 شاپ · 🩺 دامپزشک · 🪙 سکه — همه تو پت‌دیت',
  '',
  'علاوه بر همبازی، پت‌دیت خدمات کامل پت هم داره:',
  '',
  '🛒 پت‌شاپ آنلاین — غذا، لوازم و سفارش وب/ربات',
  '🩺 مشاوره دامپزشک آنلاین — صف و چت امن',
  '⚡ مشاوره سریع پزشک وقتی عجله داری',
  '🪙 سکه روزانه، خرید و کیف پول مشترک وب',
  '🛡 احراز هویت — بج تأیید‌شده روی پروفایل',
  '👤 پروفایل مالک و پت کامل — شهر، عکس، بیو',
  '',
  'یک حساب، هم تلگرام هم سایت 🌐',
  'https://petdate.ir',
  '',
  'وارد شو و امکانات رو ببین 👇',
  '🤖 @Petdatebot',
  '',
  '#پت_دیت #پت_شاپ #دامپزشک_آنلاین #سکه',
  '#احراز_هویت #خدمات_پت #کیف_پول',
  '#PetDate #همبازی_پت',
].join('\n');

const form = new FormData();
form.append('chat_id', chatId);
form.append('caption', caption);
form.append(
  'reply_markup',
  JSON.stringify({
    inline_keyboard: [[{ text: '🚀 ورود به ربات', url: botUrl }]],
  })
);
form.append('photo', new Blob([fs.readFileSync(photoPath)]), path.basename(photoPath));

const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
  method: 'POST',
  body: form,
});
const data = await res.json();
if (!data.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
const msg = data.result;
console.log(
  JSON.stringify(
    {
      ok: true,
      message_id: msg.message_id,
      chat: msg.chat?.username || msg.chat?.id,
      link: msg.chat?.username ? `https://t.me/${msg.chat.username}/${msg.message_id}` : null,
    },
    null,
    2
  )
);
