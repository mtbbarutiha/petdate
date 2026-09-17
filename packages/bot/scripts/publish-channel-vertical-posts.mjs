/**
 * Canonical publisher for @petdating VERTICAL (9:16) channel posts.
 *
 * Template docs + assets:
 *   packages/bot/assets/channel-posts/vertical/TEMPLATE.md
 *   packages/bot/assets/channel-posts/vertical/v-post-*.jpg
 *   packages/bot/assets/channel-posts/vertical/manifest.json
 *
 * Reuse this structure/style when asked «پست تولید کن».
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=… node packages/bot/scripts/publish-channel-vertical-posts.mjs
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

const CTA = {
<<<<<<< HEAD
  inline_keyboard: [[{ text: '🐾 ورود به ربات', url: 'https://t.me/Petdatebot' }]],
=======
  inline_keyboard: [[{ text: '🐾 ورود به ربات', url: 'https://t.me/Petdatebot' }]],
>>>>>>> origin/main
};

/** @type {{ file: string, topic: string, caption: string }[]} */
const posts = [
  {
    file: 'v-post-01-playmate.jpg',
    topic: 'playmate',
    caption: [
      '🐶 سگت تنهاست؟ 🐱 گربه‌ات هم دوست می‌خواد؟',
      '',
      'تنها بود… حالا دوست داره! ❤️',
      'با پت‌دیت برای پتت همبازی پیدا کن.',
      '',
      '🔍 پیدا کردن همبازی',
      '📍 پت‌دوست‌های نزدیک',
      '🩺 دامپزشک آنلاین · 🎓 مربی آنلاین',
      '🛍 پت‌شاپ · 🎉 ایونت',
      '',
      'همین الان وارد شو 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #همبازی #پت #سگ #گربه #همبازی_نزدیک #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-02-trainer.jpg',
    topic: 'trainer',
    caption: [
      '🎓 مربی آنلاین برای پتت',
      '',
      'فرمان‌پذیری، کلیکر، رفتار — بدون رفت‌وآمد.',
      'از داخل پت‌دیت به مربی وصل شو.',
      '',
      '🐾 همبازی · 🩺 دامپزشک · 🛍 شاپ · 🎉 ایونت',
      '',
      'ورود به ربات 👇',
      '🤖 @Petdatebot',
      '',
      '#PetDate #مربی_آنلاین #آموزش_سگ #پت #همبازی #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-03-vet.jpg',
    topic: 'vet',
    caption: [
      '🩺 دامپزشک آنلاین — سریع و تخصصی',
      '',
      'سوال داری؟ نگران غذایی؟ پوست و رفتار؟',
      'با پزشک‌های آنلاین پت‌دیت مشورت کن.',
      '',
      'علاوه بر این: همبازی · مربی · شاپ · ایونت',
      '',
      'شروع از ربات 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #دامپزشک_آنلاین #پزشک_پت #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-04-shop.jpg',
    topic: 'shop',
    caption: [
      '🛍 پت‌شاپ پت‌دیت',
      '',
      'غذا، اسباب‌بازی، لوازم — خرید راحت برای پتت.',
      'همه‌چیز کنار همبازی و خدمات پت.',
      '',
      'PLAY • MEET • FRIENDS ✨',
      '',
      'ورود 👇',
      '🤖 @Petdatebot',
      '',
      '#PetDate #پت_شاپ #خرید_پت #سگ #گربه #همبازی #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-05-event.jpg',
    topic: 'events',
    caption: [
      '🎉 ایونت‌های پت نزدیکت',
      '',
      'دورهمی، پیاده‌روی گروهی، پت‌دیتینگ…',
      'ببین، بساز یا بپیوند — توی شهرت.',
      '',
      '📍 همبازی نزدیک | 🩺 دامپزشک | 🛍 پت‌شاپ',
      '',
      'از ربات شروع کن 👇',
      '🤖 @Petdatebot',
      '',
      '#PetDate #ایونت_پت #دورهمی #همبازی #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-06-nearby.jpg',
    topic: 'nearby',
    caption: [
      '📍 پت‌دوست‌های نزدیکت رو پیدا کن',
      '',
      'هم‌محله · هم‌استان · نزدیک GPS',
      'برای سگت همبازی، برای گربه‌ات دوست جدید.',
      '',
      '🩺 دامپزشک آنلاین · 🎓 مربی · 🛍 شاپ · 🎉 ایونت',
      '',
      'ورود به ربات 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #همبازی_نزدیک #نزدیک_من #پت #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-07-community.jpg',
    topic: 'community',
    caption: [
      '💜 جامعه پت‌دوست‌های ایران',
      '',
      'آشنا شو، ارتباط بگیر، همبازی بساز.',
      'پت‌دیت فقط یک اپ نیست — یه جامعه است.',
      '',
      'همبازی · مربی · دامپزشک · شاپ · ایونت',
      '',
      'بیا داخل 👇',
      '🤖 @Petdatebot',
      '',
      '#PetDate #جامعه_پت #پت_دوست #همبازی #سگ #گربه #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-08-consult.jpg',
    topic: 'consult',
    caption: [
      '💬 هنوز پت نداری؟ مشورت بگیر',
      '',
      'از صاحبین باتجربه بپرس: نژاد، هزینه، نگهداری.',
      'وقتی آماده شدی — ثبت پت و همبازی.',
      '',
      '🩺 دامپزشک · 🎓 مربی · 🛍 شاپ · 🎉 ایونت',
      '',
      'ورود 👇',
      '🤖 @Petdatebot · PetDate.ir',
      '',
      '#PetDate #مشورت_پت #بدون_پت #همبازی #دامپزشک #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-09-profile.jpg',
    topic: 'profile',
    caption: [
      '🐾 پروفایل پت بساز',
      '',
      'عکس، نژاد، شهر — دیده شو تا همبازی پیدا کنه.',
      'بعدش: نزدیک‌ها، ایونت، دامپزشک، شاپ.',
      '',
      'PLAY • MEET • FRIENDS ✨',
      '',
      'شروع در ربات 👇',
      '🤖 @Petdatebot',
      '',
      '#PetDate #پروفایل_پت #همبازی #سگ #گربه #ربات_پت #پت_دیت',
    ].join('\n'),
  },
  {
    file: 'v-post-10-all.jpg',
    topic: 'all-features',
    caption: [
      '🐾❤️ پتت هم دوست می‌خواد؟',
      '',
      'همه امکانات پت‌دیت در یک جا:',
      '',
      '🔍 همبازی نزدیک',
      '🎓 مربی آنلاین',
      '🩺 دامپزشک آنلاین',
      '🛍 پت‌شاپ',
      '🎉 ایونت',
      '',
      'همه در پت‌دیت · PetDate.ir',
      '🤖 @Petdatebot',
      '',
      '#PetDate #همبازی #مربی_آنلاین #دامپزشک_آنلاین #پت_شاپ #ایونت #سگ #گربه #پت_دیت',
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
