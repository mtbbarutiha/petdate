import { Reply, X } from 'lucide-react';
import {
  chatReplySnippetBody,
  type ChatReplySnippet,
  type PlaydateChatMediaKind,
} from '@petdate/shared';

export type ChatReplyTarget = {
  id: number;
  fromLabel: string;
  text: string;
  mediaKind?: PlaydateChatMediaKind | null;
};

export function replySnippetToTarget(
  snippet: ChatReplySnippet,
  fromLabel: string
): ChatReplyTarget {
  return {
    id: snippet.id,
    fromLabel,
    text: snippet.text,
    mediaKind: snippet.mediaKind,
  };
}

export function ChatReplyQuote({
  fromLabel,
  text,
  mediaKind,
  onClick,
}: {
  fromLabel: string;
  text: string;
  mediaKind?: PlaydateChatMediaKind | string | null;
  onClick?: () => void;
}) {
  const body = chatReplySnippetBody({
    text,
    mediaKind: mediaKind as PlaydateChatMediaKind | null,
  });
  if (onClick) {
    return (
      <button type="button" className="tg-reply-quote" onClick={onClick} dir="auto">
        <span className="tg-reply-quote-bar" aria-hidden />
        <span className="tg-reply-quote-body">
          <strong className="tg-reply-quote-from">{fromLabel}</strong>
          <span className="tg-reply-quote-text">{body || 'پیام'}</span>
        </span>
      </button>
    );
  }
  return (
    <div className="tg-reply-quote" dir="auto">
      <span className="tg-reply-quote-bar" aria-hidden />
      <span className="tg-reply-quote-body">
        <strong className="tg-reply-quote-from">{fromLabel}</strong>
        <span className="tg-reply-quote-text">{body || 'پیام'}</span>
      </span>
    </div>
  );
}

export function ChatReplyComposerBar({
  target,
  onCancel,
}: {
  target: ChatReplyTarget;
  onCancel: () => void;
}) {
  return (
    <div className="tg-reply-composer" role="status">
      <Reply size={16} className="tg-reply-composer-ico" aria-hidden />
      <div className="tg-reply-composer-copy" dir="auto">
        <strong>پاسخ به {target.fromLabel}</strong>
        <span>
          {chatReplySnippetBody({
            text: target.text,
            mediaKind: target.mediaKind,
          }) || 'پیام'}
        </span>
      </div>
      <button
        type="button"
        className="tg-reply-composer-clear"
        onClick={onCancel}
        aria-label="لغو پاسخ"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ChatReplyActionButton({
  onClick,
  label = 'پاسخ',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="tg-reply-action"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Reply size={14} />
      <span>{label}</span>
    </button>
  );
}
