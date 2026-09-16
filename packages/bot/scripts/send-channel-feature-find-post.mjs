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
    '../assets/channel-posts/petdate-channel-post-find-playmate.jpg'
  );
const botUrl = process.env.BOT_URL || 'https://t.me/Petdatebot?start=channel';

const caption = [
  '🔍 همبازی نزدیکه… فقط باید پیداش کنی',
  '',
  'پت‌ات بیرون منتظر دوست جدیده 🐶🐱',
  'تو پت‌دیت مچ هوشمند، جستجو و نقشهٔ همبازی یک‌جاست',
  '',
  'چطور کار می‌کنه؟',
  '🐾 پت‌ات رو ثبت کن و عکس بذار',
  '🔍 «پیدا کردن همبازی» رو بزن — درخواست اتوماتیک می‌ره',
  '📍 پت‌های هم‌شهر، هم‌استان و نزدیک رو ببین',
  '🔎 با گونه و نژاد جستجو کن و لیست رو ورق بزن',
  '💬 بعد از قبول، چت امن همبازی باز می‌شه',
  '',
  'نذار امروز هم بدون همبازی تموم بشه ❤️‍🔥',
  '',
  'شروع کن 👇',
  '🤖 @Petdatebot',
  '',
  '#پت_دیت #همبازی #همبازی_پت #پیدا_کردن_همبازی',
  '#سگ #گربه #پت_نزدیک #دوستیابی_پت',
  '#PetDate #ایران',
].join('\n');

const form = new FormData();
form.append('chat_id', chatId);
form.append('caption', caption);
form.append(
  'reply_markup',
  JSON.stringify({
    inline_keyboard: [[{ text: '🔍 پیدا کردن همبازی', url: botUrl }]],
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
