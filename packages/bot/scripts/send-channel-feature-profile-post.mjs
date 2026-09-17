import fs from 'fs';
import path from 'path';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

const chatId = process.env.CHANNEL || '@petdating';
const photoPath =
  process.env.PHOTO ||
  '/agent/packages/bot/assets/channel-posts/petdate-channel-post-profile-coins.jpg';

const caption = [
  'پروفایلت کامل بشه، اعتماد بیشتر می‌شه ✅✨',
  '',
  'مالک خوب = پت خوشحال‌تر.',
  'تو petdate پروفایل، سکه و احراز یک‌جا جمعه 🐾',
  '',
  'تو petdate می‌تونی:',
  '👤 پروفایل مالک رو کامل کنی — شهر، استان، عکس',
  '🪙 سکه بگیری — روزانه، خرید و فروش',
  '💵 کسب درآمد — سکه‌هات رو نقد کن',
  '🛡 احراز هویت کنی — بج ✅ احراز شده روی پروفایل',
  '🎁 دوستات رو معرفی کنی و خدمات پت بگیری',
  '',
  'پروفایل قوی‌تر، همبازی بهتر…',
  'بج احراز یعنی بقیه راحت‌تر اعتماد می‌کنن ❤️‍🔥',
  '',
  'همین الان وارد شو 👇',
  '🤖 @Petdatebot',
  '',
  '#petdate #پروفایل #سکه #احراز_هویت',
  '#پت #همبازی #کسب_درآمد #خدمات_پت',
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
