import type { ChatReplySnippet, PlaydateChatMediaKind } from './petdate';

/** Max chars kept in reply quote snippets (UI + Telegram prefix). */
export const CHAT_REPLY_SNIPPET_MAX = 120;

export function truncateChatReplyText(
  text: string,
  max = CHAT_REPLY_SNIPPET_MAX
): string {
  const t = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function mediaKindReplyLabel(
  kind?: PlaydateChatMediaKind | null
): string {
  switch (kind) {
    case 'photo':
      return 'تصویر';
    case 'video':
    case 'animation':
    case 'video_note':
      return 'ویدیو';
    case 'voice':
      return 'پیام صوتی';
    case 'audio':
      return 'فایل صوتی';
    case 'document':
      return 'فایل';
    case 'sticker':
      return 'استیکر';
    case 'gift':
      return 'هدیه';
    default:
      return '';
  }
}

/** Display body for a reply quote (text or media placeholder). */
export function chatReplySnippetBody(
  snippet: Pick<ChatReplySnippet, 'text' | 'mediaKind'> | null | undefined
): string {
  if (!snippet) return '';
  const text = truncateChatReplyText(snippet.text);
  if (text && !/^\[(تصویر|ویدیو|پیام صوتی|فایل صوتی|فایل|استیکر|رسانه|هدیه)\]$/.test(text)) {
    return text;
  }
  const label = mediaKindReplyLabel(snippet.mediaKind);
  return label || text || 'پیام';
}

/** Prefix for Telegram fan-out so peers see reply context without TG reply_to mapping. */
export function formatTelegramReplyPrefix(
  snippet: Pick<ChatReplySnippet, 'text' | 'mediaKind'> | null | undefined
): string {
  const body = chatReplySnippetBody(snippet);
  if (!body) return '';
  return `↩️ ${body}`;
}

export function withTelegramReplyPrefix(
  text: string,
  snippet: Pick<ChatReplySnippet, 'text' | 'mediaKind'> | null | undefined
): string {
  const prefix = formatTelegramReplyPrefix(snippet);
  const body = String(text ?? '').trim();
  if (!prefix) return body;
  if (!body) return prefix;
  return `${prefix}\n\n${body}`;
}
