import fs from 'fs';
import path from 'path';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

const chatId = process.env.CHANNEL || '@petdating';
const photoPath =
  process.env.PHOTO ||
  '/agent/packages/bot/assets/channel-posts/petdate-channel-post-find-playmate.jpg';

const caption = [
  'همبازی نزدیکه… فقط باید پیداش کنی 🔍🐾',
  '',
  'پت‌ات بیرون منتظر دوست جدیده.',
  'تو همون‌جایی، فقط یه جستجو فاصله‌ست 😏🐶🐱',
  '',
  'تو petdate می‌تونی:',
  '🔍 پیدا کردن همبازی — مچ هوشمند با پت‌های مناسب',
  '📍 پت‌های نزدیک من — بر اساس شهر و استان',
  '🔎 جستجوی پت — گونه → نژاد، هم‌استان، مشهد، همه',
  '📋 لیست صفحه‌بندی‌شده — راحت ورق بزن و انتخاب کن',
  '',
  'دوست پتت شاید همین دور و بره…',
  'نذار امروز هم بدون همبازی تموم بشه ❤️‍🔥',
  '',
  'همین الان وارد شو 👇',
  '🤖 @Petdatebot',
  '',
  '#petdate #همبازی #پت #سگ #گربه',
  '#جستجوی_پت #پت_نزدیک #پیدا_کردن_همبازی',
].join('\n');

const form = new FormData();
form.append('chat_id', chatId);
form.append('caption', caption);
form.append(
  'reply_markup',
  JSON.stringify({
    inline_keyboard: [[{ text: '🐾 ورود به ربات', url: 'https://t.me/Petdatebot' }]],
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
