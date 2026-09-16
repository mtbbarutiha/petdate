import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

const chatId = process.env.CHANNEL || '@petdating';
const photoPath =
  process.env.PHOTO ||
  path.join(__dirname, '../assets/channel-posts/petdate-channel-post-cover.jpg');
const botUrl = process.env.BOT_URL || 'https://t.me/Petdatebot?start=channel';

const caption = [
  '🐾 پت‌دیت اینجاست — دنیای پت‌هات یک‌جا',
  'PLAY • MEET • FRIENDS',
  '',
  'پت‌دیت فقط یه ربات نیست؛',
  'جایی برای پیدا کردن همبازی، خرید، مشاوره و جامعهٔ پت‌دوست‌هاست 🐶🐱',
  '',
  'تو پت‌دیت می‌تونی:',
  '🔍 همبازی برای سگ و گربه‌ات پیدا کنی',
  '🛒 از پت‌شاپ آنلاین خرید کنی',
  '🩺 با دامپزشک آنلاین مشورت کنی',
  '🪙 سکه بگیری و خدمات پت استفاده کنی',
  '🌐 روی وب و تلگرام با یک حساب باشی',
  '',
  'همبازی برای پت‌ات، از همین‌جا شروع می‌شه ✨',
  '',
  'ورود به ربات 👇',
  '🤖 @Petdatebot',
  '🌐 https://petdate.ir',
  '',
  '#پت_دیت #PetDate #همبازی_پت #پت',
  '#سگ #گربه #پت_شاپ #دامپزشک_آنلاین',
  '#ربات_تلگرام #ایران',
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
