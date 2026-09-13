# ایمیل petdate.ir — Postfix + Dovecot + OpenDKIM

Mailbox هدف: **`info@petdate.ir`** (آلیاس‌ها: `hello@` / `no-reply@` / `noreply@` / postmaster / abuse → همان inbox).

ارسال OTP اپ از **`no-reply@petdate.ir`** (هویت From + Return-Path؛ mailbox جدا لازم نیست).

نام نمایشی From: **`پت‌دیت`** (فارسی — نه `PetDate`، تا جیمیل «Translate to English» نزند). لوگو داخل ایمیل به‌صورت **CID/پیوست inline** است (نه لینک ریموت)، تا در اینباکس دیده شود.

VPS مبدأ: `185.110.189.218` — هاست میل: `mail.petdate.ir`

---

## چرا می‌رود اسپم؟ (وضعیت واقعی DNS — ۲۰۲۶-۰۹-۰۷)

| رکورد | مقدار فعلی | اثر روی اسپم |
|--------|------------|----------------|
| `MX petdate.ir` | `10 185.110.189.218.` | بهتر است نام هاست باشد؛ برای **ارسال** OTP حیاتی نیست |
| `A mail.petdate.ir` | `185.239.1.100` (WCDN) | **غلط** — پروکسی CDN برای میل ممنوع |
| `TXT @` (SPF) | `v=spf1 ip4:185.110.189.218 a:mail.petdate.ir mx -all` | `ip4` درست است → SPF معمولاً Pass؛ ولی `a:mail` تا اصلاح A بی‌معنی/گمراه‌کننده است |
| `TXT mail._domainkey` | `"RSA"` و `"185.110.189.218"` | **غلط کامل** → DKIM Fail |
| `TXT _dmarc` | `"SPF"` | **غلط کامل** → DMARC بی‌اثر |
| PTR / rDNS | ندارد / `srv5498305369` | **عامل قوی اسپم** — باید `mail.petdate.ir` شود |

> تا وقتی DKIM/DMARC/mail A/PTR در پنل درست نشوند، سرور می‌فرستد ولی Gmail/Yahoo اغلب می‌گذارند Spam. این را فقط با DNS (و PTR هاست) می‌شود درست کرد.

---

## کارهایی که روی VPS انجام شده

- Postfix: `myhostname` / `smtp_helo_name` = `mail.petdate.ir` (نه hostname سیستم `srv…`)
- OpenDKIM: امضای `d=petdate.ir` با selector=`mail` برای همه `*@petdate.ir`
- Envelope-from اپ = همان From (`no-reply@petdate.ir`) برای هم‌ترازی SPF/DMARC
- Message-ID روی دامنه `petdate.ir`؛ هدرهای transactional (`Auto-Submitted`)
- کلید عمومی یک‌خطی: `/root/.petdate-mail/dkim-txt-oneline.txt`

---

## رکوردهایی که باید در پنل DNS بگذارید (ParsPack / Arvan)

**برای ساب‌دامین `mail`:** فقط DNS / grey cloud — **Proxy / WCDN خاموش**.

رکوردهای TXT اشتباه فعلی (`RSA`، IP خام، `SPF`) را **حذف** کنید، بعد این‌ها را بسازید:

| # | نوع | نام (Host) | مقدار (Value) | اولویت |
|---|-----|------------|---------------|--------|
| 1 | **A** | `mail` | `185.110.189.218` | — |
| 2 | **MX** | `@` | `mail.petdate.ir.` | **10** |
| 3 | **TXT** | `@` | `v=spf1 ip4:185.110.189.218 -all` | — |
| 4 | **TXT** | `mail._domainkey` | *(یک خط کامل پایین)* | — |
| 5 | **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@petdate.ir; fo=1; adkim=r; aspf=r` | — |

بعد از اینکه `A mail` درست شد، اختیاری SPF را به این عوض کنید:

```
v=spf1 ip4:185.110.189.218 a:mail.petdate.ir mx -all
```

### مقدار TXT برای `mail._domainkey` (یک رکورد — کپی کامل یک خط)

```
v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtFt173AGZkIYu6UPE2qbmAjlYtd7DzfelmmBAH/n7XBrlvZFh2beekfxMNw8OYCcAWobiZcPdcXNtzSK4sFbkSVoSFqJ6a/krm1R+aOAjnKsYgfn6Hhmu/mDQOXxFNVqEhCdByONCfWihrs12uwwTTlCCro4W41qHlf4sCm8xnT9yEq4j1glLyxk5WMLuz4jygs2uAbv1oj7WmhGCzPu1TQOFkxwpgJ97VZZRnwRgOeD9P465BdfgxkQyVfFX6ukijuqg/hpGZWlOIqTVj+jlbKsCfxD2ZkLNCotnSjRre0o8EuvYRtYX6SYHqUvFtwdlQ53kr/M+CuFPjujt7MivQIDAQAB
```

کپی دوباره از سرور:

```bash
ssh root@185.110.189.218 'cat /root/.petdate-mail/dkim-txt-oneline.txt'
```

### PTR (rDNS) — تیکت به پشتیبانی هاست (BitCommand / ParsPack)

متن پیشنهادی تیکت:

> لطفاً PTR آی‌پی `185.110.189.218` را روی `mail.petdate.ir` تنظیم کنید. این سرور SMTP دامنه petdate.ir است.

بدون PTR، حتی با SPF/DKIM درست، احتمال اسپم بالاست.

### بعد از درست شدن `A mail`

Full deploy runs `infra/mail/ensure-mail-le-cert.sh` (idempotent, best-effort): certbot when Google DNS already shows `185.110.189.218`, then wires Postfix/Dovecot. Manual:

```bash
certbot certonly --nginx -d mail.petdate.ir
bash /opt/petdate/infra/mail/ensure-mail-le-cert.sh
# or full stack rewrite:
bash /opt/petdate/infra/mail/setup-mail.sh
```

Wait for **all resolvers** to drop the old WCDN A `185.239.1.100` (TTL flush). Let's Encrypt HTTP-01 fails while any LE resolver still sees WCDN.

### تأیید بعد از انتشار DNS (۵–۳۰ دقیقه)

```bash
dig +short A mail.petdate.ir          # باید 185.110.189.218 باشد
dig +short MX petdate.ir              # باید 10 mail.petdate.ir. باشد
dig +short TXT petdate.ir             # باید با v=spf1 ip4:185.110.189.218 شروع شود
dig +short TXT mail._domainkey.petdate.ir   # باید با v=DKIM1 شروع شود و p=MIIB… داشته باشد
dig +short TXT _dmarc.petdate.ir      # باید با v=DMARC1 شروع شود
dig +short -x 185.110.189.218         # باید mail.petdate.ir. باشد (بعد از PTR)
```

ابزار خارجی: [mxtoolbox.com/SuperTool.aspx](https://mxtoolbox.com/SuperTool.aspx) → SPF / DKIM / DMARC / Blacklist.

---

## دسترسی به mailbox

| | |
|--|--|
| آدرس | `info@petdate.ir` |
| آلیاس | `hello@`، `no-reply@`، `noreply@`، `news@` → `info@` |
| From اپ (OTP) | `no-reply@petdate.ir` |
| From خبرنامه | `news@petdate.ir` (Reply-To → `info@`) |
| IMAP | `mail.petdate.ir` پورت **993** (SSL) |
| SMTP | `mail.petdate.ir` پورت **587** (STARTTLS) یا **465** (SSL) |
| Username | `info@petdate.ir` (آدرس کامل) |

رمز روی سرور است (در چت چاپ نمی‌شود):

```bash
ssh root@185.110.189.218 'sudo cat /root/.petdate-mail/info.password'
```

ریست رمز:

```bash
ssh root@185.110.189.218 'bash /opt/petdate/infra/mail/reset-mailbox-password.sh info'
```

تا وقتی DNS میل به origin نرسیده، کلاینت می‌تواند موقتاً به IP مستقیم وصل شود (با هشدار گواهی self-signed): هاست `185.110.189.218`.

## نصب روی VPS

```bash
cd /opt/petdate
bash infra/mail/setup-mail.sh
```

اسکریپت: Postfix + Dovecot + OpenDKIM، فایروال پورت‌های 25/465/587/993، mailbox مجازی، آلیاس hello/no-reply/noreply/postmaster/abuse. nginx روی 80/443 دست نخورده می‌ماند.

## SMTP اپ (OTP ایمیل)

روی VPS در `/opt/petdate/.env`:

```
SMTP_HOST=127.0.0.1
SMTP_PORT=25
SMTP_FROM=no-reply@petdate.ir
SMTP_FROM_NAME=پت‌دیت
SMTP_HELO_NAME=mail.petdate.ir
SMTP_REPLY_TO=info@petdate.ir
SMTP_TLS_REJECT_UNAUTHORIZED=0
```

API کد OTP را با From + Return-Path = `no-reply@petdate.ir` می‌فرستد؛ OpenDKIM برای `*@petdate.ir` امضا می‌کند.

`SMTP_TLS_REJECT_UNAUTHORIZED=0` is for local `127.0.0.1` Postfix. After LE is on :465/:587/:993, remote clients should see a public cert (not `O=PetDate` self-signed).

### پنل مشاهده ارسال (ادمین وب)

- URL: `https://petdate.ir/admin/mail`
- ورود: `https://petdate.ir/admin/login` با رمز `ADMIN_PASSWORD`
- نشان می‌دهد: host/port/from، وضعیت پورت، **صندوق ورودی `info@`** (خواندن + ریپلای)، لاگ ارسال‌ها، OTPهای ایمیل فعال، و دکمهٔ تست ارسال
- مسیر: `/admin/mail` — صندوق ورودی از Maildir محلی (`MAIL_INBOX_PATH`) خوانده می‌شود؛ پاسخ با From=`info@petdate.ir` می‌رود

## تست روی سرور

```bash
ss -tlnp | grep -E ':25|:465|:587|:993'
# تست محلی با envelope درست:
printf 'Subject: probe\nFrom: no-reply@petdate.ir\nTo: info@petdate.ir\n\nok\n' \
  | sendmail -t -f no-reply@petdate.ir
tail -50 /var/log/mail.log   # باید DKIM-Signature field added ببینید
```

**ارسال OTP از اپ** از طریق `127.0.0.1:25` کار می‌کند؛ برای inbox، DNS بالا + PTR را درست کنید.
