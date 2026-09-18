/**
 * Publish 5 PetDate ACTIVITY vertical posts to @petdating (9:16).
 *
 * Complements the canonical 10-post set (v-post-01..10 / message_ids 121–130).
 * New assets: v-post-11..15 — playmate, shop, vet, adoption, events.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=… node packages/bot/scripts/publish-channel-activity-posts.mjs
 *   CHANNEL=@petdating POST_DELAY_MS=2500 DRY_RUN=1 node …
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(
  __dirname,
  '../assets/channel-posts/vertical'
);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token && process.env.DRY_RUN !== '1') {
  throw new Error('TELEGRAM_BOT_TOKEN missing');
}

const chatId = process.env.CHANNEL || '@petdating';
const delayMs = Number(process.env.POST_DELAY_MS || 2500);
const dryRun = process.env.DRY_RUN === '1';

/** Paw CTA — never dog emoji (see TEMPLATE.md / #560–#562). */
const CTA = {
  inline_keyboard: [[{ text: '🐾 ورود به ربات', url: 'https://t.me/Petdatebot' }]],
};

/** @type {{ file: string, topic: string, caption: string }[]} */
const posts = [
  {
    file: 'v-post-11-playmate.jpg',
    topic: 'playmate',
    caption: [
      '🐾 همبازی برای پتت',
      '',
      'سگت یا گربه‌ات تنهاست؟',
      'با پت‌دیت همبازی نزدیک پیدا کن — آشنا شو، قرار بگذار، بازی کنید.',
      '',
      '🔍 پیدا کردن همبازی',
      '📍 پت‌دوست‌های نزدیک',
      '🛍 پت‌شاپ · 🩺 دامپزشک · 🎉 ایونت',
      '',
      'همین الان وارد شو 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #همبازی #همبازی_پت #پت #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-12-shop.jpg',
    topic: 'shop',
    caption: [
      '🛍 پت‌شاپ پت‌دیت',
      '',
      'غذا، اسباب‌بازی، لوازم — خرید راحت برای پتت.',
      'همه‌چیز کنار همبازی، دامپزشک و ایونت.',
      '',
      'PLAY • MEET • FRIENDS ✨',
      '',
      'ورود 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #پت_شاپ #خرید_پت #سگ #گربه #همبازی #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-13-vet.jpg',
    topic: 'vet',
    caption: [
      '🩺 دامپزشک آنلاین — سریع و تخصصی',
      '',
      'سوال داری؟ نگران غذایی؟ پوست و رفتار؟',
      'با پزشک‌های آنلاین پت‌دیت مشورت کن.',
      '',
      'علاوه بر این: همبازی · شاپ · پذیرش · ایونت',
      '',
      'شروع از ربات 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #دامپزشک_آنلاین #مشاوره_پت #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-14-adoption.jpg',
    topic: 'adoption',
    caption: [
      '🏠 پذیرش حیوان خانگی',
      '',
      'پت‌های نیازمند خانه منتظرن.',
      'پذیرش مسئولانه — پیدا کن، بشناس، خونه بده.',
      '',
      '🐾 همبازی · 🩺 دامپزشک · 🛍 شاپ · 🎉 ایونت',
      '',
      'از ربات شروع کن 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #پذیرش_پت #پذیرش_حیوان_خانگی #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-15-event.jpg',
    topic: 'events',
    caption: [
      '🎉 ایونت‌های پت · پت‌دیتینگ پارک',
      '',
      'دورهمی، پیاده‌روی گروهی، آشنایی در پارک…',
      'ببین، بساز یا بپیوند — توی شهرت.',
      '',
      '📍 همبازی نزدیک | 🩺 دامپزشک | 🛍 پت‌شاپ | 🏠 پذیرش',
      '',
      'از ربات شروع کن 👇',
      '🤖 @Petdatebot',
      '',
      '#PetDate #ایونت_پت #پت_دیتینگ #دورهمی #همبازی #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const results = [];
for (const post of posts) {
  const photoPath = path.join(assetsDir, post.file);
  if (!fs.existsSync(photoPath)) throw new Error(`missing ${photoPath}`);
  if (post.caption.length > 1024) {
    throw new Error(`caption too long: ${post.file} ${post.caption.length}`);
  }

  if (dryRun) {
    results.push({
      file: post.file,
      topic: post.topic,
      ok: true,
      dryRun: true,
      bytes: fs.statSync(photoPath).size,
      captionChars: post.caption.length,
    });
    console.log('DRY', post.topic, post.file);
    continue;
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', post.caption);
  form.append('reply_markup', JSON.stringify(CTA));
  form.append('photo', new Blob([fs.readFileSync(photoPath)]), path.basename(photoPath));

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.ok) {
    console.error('FAIL', post.file, JSON.stringify(data, null, 2));
    results.push({ file: post.file, topic: post.topic, ok: false, error: data });
    break;
  }
  const msg = data.result;
  const link = msg.chat?.username
    ? `https://t.me/${msg.chat.username}/${msg.message_id}`
    : null;
  results.push({
    file: post.file,
    topic: post.topic,
    ok: true,
    message_id: msg.message_id,
    link,
  });
  console.log('OK', post.topic, link);
  await sleep(delayMs);
}

const summary = {
  channel: chatId,
  assetsDir,
  posted: results.filter((r) => r.ok).length,
  results,
};
console.log(JSON.stringify(summary, null, 2));
if (results.some((r) => !r.ok)) process.exit(1);
