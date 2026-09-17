import fs from 'fs';
import path from 'path';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

const chatId = process.env.CHANNEL || '@petdating';
const photoPath = process.env.PHOTO || '/agent/packages/bot/assets/channel-posts/petdate-channel-post-cover.jpg';

const caption = [
  'پت‌ات همبازی می‌خواد… 🐾✨',
  '',
  'حوصله‌ش سر رفته؟',
  'تو خونه تنها بازی می‌کنه؟',
  'نذار امروز هم بدون دوست رد بشه 😏🐶🐱',
  '',
  'تو petdate می‌تونی:',
  '🔍 همبازی نزدیک پیدا کنی',
  '📍 پت‌های هم‌محله و هم‌استان رو ببینی',
  '🐾 پروفایل پت بسازی و عکس بذاری',
  '🩺 خدمات و مشاوره پت بگیری',
  '',
  'همبازی برای پت‌ات همین‌جاست…',
  'شاید دوست پتت همین‌جا منتظرته ❤️‍🔥',
  '',
  'همین الان وارد شو 👇',
  '🤖 @Petdatebot',
  '',
  '#petdate #همبازی #پت #سگ #گربه',
  '#ربات_پت #پیدا_کردن_همبازی #تنها_نذار',
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
