/**
 * Deliver issued prescription into the active vet↔patient consult chat
 * (web thread + Telegram relay). Chat is the always-on path; SMS is extra
 * when the patient has a usable mobile number.
 */
import fs from 'fs';
import { infra } from '../config/infra';
import { dbService } from '../db';
import { saveChatUpload } from './chat-upload-store';
import type { SmsDeliveryStatus } from './prescription';
import { notifyVetMessage } from '../ws/chatHub';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';
import type { VetConsultChatMessage } from '@petdate/shared';
import { normalizeTelegramId } from './telegram-id';

export type PrescriptionChatDelivery = {
  chatMessage: VetConsultChatMessage | null;
  /** Patient Telegram got a link and/or PDF document */
  telegramDelivered: boolean;
  /** Human-readable status for vet UIs */
  note: string;
};

function smsSkippedNoPhone(sms: SmsDeliveryStatus): boolean {
  return (
    sms.sent === false &&
    sms.skipped === true &&
    !sms.failed &&
    /موبایل|شماره/.test(sms.reason)
  );
}

/**
 * Caption shown in web chat (and mirrored to Telegram).
 * Primary line always includes the public PDF download URL.
 */
export function buildPrescriptionChatCaption(opts: {
  prescriptionId: number;
  petName?: string;
  pdfPublicUrl: string;
  webUrl?: string;
  sms: SmsDeliveryStatus;
}): string {
  const lines: Array<string | null> = [
    `نسخه صادر شد — دانلود PDF: ${opts.pdfPublicUrl}`,
    opts.petName ? `پت: ${opts.petName}` : null,
    opts.prescriptionId > 0 ? `شماره نسخه: ${opts.prescriptionId}` : null,
  ];

  if (opts.sms.sent === true) {
    lines.push(`📱 پیامک نسخه برای بیمار (${opts.sms.phone}) ارسال شد.`);
  } else if (smsSkippedNoPhone(opts.sms)) {
    lines.push('💬 شماره موبایل ثبت نشده — نسخه در همین چت ارسال شد.');
  } else if (opts.sms.sent === false) {
    lines.push(`⚠️ پیامک ارسال نشد: ${opts.sms.reason}`);
  }

  return lines.filter(Boolean).join('\n');
}

async function telegramSendMessage(
  chatId: string,
  text: string,
  protectContent?: boolean
): Promise<boolean> {
  const token = infra.telegram.botToken;
  if (!token) return false;
  try {
    const res = await telegramFetch(telegramBotApiUrl(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(protectContent ? { protect_content: true } : {}),
      }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn('prescription telegram sendMessage failed:', data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('prescription telegram sendMessage error:', (err as Error).message);
    return false;
  }
}

async function telegramSendDocument(opts: {
  chatId: string;
  pdfPath: string;
  fileName: string;
  caption: string;
  protectContent?: boolean;
}): Promise<boolean> {
  const token = infra.telegram.botToken;
  if (!token || !fs.existsSync(opts.pdfPath)) return false;
  try {
    const buf = fs.readFileSync(opts.pdfPath);
    const form = new FormData();
    form.append('chat_id', opts.chatId);
    form.append('caption', opts.caption.slice(0, 1024));
    if (opts.protectContent) form.append('protect_content', 'true');
    form.append(
      'document',
      new Blob([new Uint8Array(buf)], { type: 'application/pdf' }),
      opts.fileName
    );
    const res = await telegramFetch(telegramBotApiUrl(token, 'sendDocument'), {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn('prescription telegram sendDocument failed:', data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('prescription telegram sendDocument error:', (err as Error).message);
    return false;
  }
}

/**
 * Always post the PDF (document + caption with public link) into the consult
 * chat, notify both sides over WebSocket, and relay to the patient's Telegram
 * when linked. SMS remains separate (handled by createPrescriptionWithDelivery).
 */
export async function deliverPrescriptionToConsultChat(opts: {
  consultId: number;
  prescriptionId: number;
  pdfPath: string;
  pdfPublicUrl: string;
  webUrl?: string;
  vetUserId: number;
  patientUserId: number;
  petName?: string;
  sms: SmsDeliveryStatus;
}): Promise<PrescriptionChatDelivery> {
  const caption = buildPrescriptionChatCaption({
    prescriptionId: opts.prescriptionId,
    petName: opts.petName,
    pdfPublicUrl: opts.pdfPublicUrl,
    webUrl: opts.webUrl,
    sms: opts.sms,
  });

  let chatMessage: VetConsultChatMessage | null = null;

  if (opts.pdfPath && fs.existsSync(opts.pdfPath)) {
    const fileName = `petdate-dr-rx-${opts.prescriptionId}.pdf`;
    const pdfBuf = fs.readFileSync(opts.pdfPath);
    const saved = saveChatUpload({
      folderId: `vet-${opts.consultId}`,
      originalName: fileName,
      buffer: pdfBuf,
    });
    chatMessage = dbService.createVetConsultChatMessage({
      consultId: opts.consultId,
      senderUserId: opts.vetUserId,
      text: caption,
      mediaKind: 'document',
      storageKey: saved.storageKey,
      mimeType: 'application/pdf',
      fileName,
    });
    notifyVetMessage(opts.consultId, chatMessage, [
      opts.vetUserId,
      opts.patientUserId,
    ]);
  } else {
    // PDF file missing — still post a text notice with the public link so the
    // patient is never left without a download path.
    chatMessage = dbService.createVetConsultChatMessage({
      consultId: opts.consultId,
      senderUserId: opts.vetUserId,
      text: caption,
    });
    notifyVetMessage(opts.consultId, chatMessage, [
      opts.vetUserId,
      opts.patientUserId,
    ]);
  }

  let telegramDelivered = false;
  const patient = dbService.getUserById(opts.patientUserId);
  const consult = dbService.getVetConsultation(opts.consultId);
  const protect = Boolean(consult?.chatSecure);
  const tgId = normalizeTelegramId(patient?.telegramId);

  if (tgId) {
    // Prefer document+caption; fall back to plain text with the PDF URL.
    if (opts.pdfPath && fs.existsSync(opts.pdfPath)) {
      telegramDelivered = await telegramSendDocument({
        chatId: tgId,
        pdfPath: opts.pdfPath,
        fileName: `petdate-dr-rx-${opts.prescriptionId}.pdf`,
        caption,
        protectContent: protect,
      });
    }
    if (!telegramDelivered) {
      telegramDelivered = await telegramSendMessage(tgId, caption, protect);
    }
  }

  const note = smsSkippedNoPhone(opts.sms)
    ? telegramDelivered
      ? 'شماره موبایل نیست — نسخه در چت وب و تلگرام بیمار ارسال شد'
      : 'شماره موبایل نیست — نسخه در چت مشاوره ثبت شد'
    : telegramDelivered
      ? 'نسخه در چت و تلگرام بیمار ارسال شد'
      : 'نسخه در چت مشاوره ثبت شد';

  console.info(
    `[prescription] chat delivery rx=${opts.prescriptionId} consult=${opts.consultId} chatMsg=${chatMessage?.id ?? 'none'} tg=${telegramDelivered} note=${note}`
  );

  return { chatMessage, telegramDelivered, note };
}
