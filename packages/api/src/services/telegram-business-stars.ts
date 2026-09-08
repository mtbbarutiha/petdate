import { infra } from '../config/infra';

type TelegramApiResult<T> = {
  ok?: boolean;
  description?: string;
  result?: T;
};

export type BusinessStarBalanceResult =
  | { ok: true; amount: number; nanostarAmount?: number }
  | { ok: false; error: string; code?: string };

async function telegramCall<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramApiResult<T> | null> {
  const token = infra.telegram.botToken;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return (await res.json()) as TelegramApiResult<T>;
  } catch (err) {
    console.warn(`telegram ${method} error:`, (err as Error).message);
    return null;
  }
}

/** آیا ربات در BotFather برای Business Mode فعال است؟ */
export async function botCanConnectToBusiness(): Promise<boolean> {
  const data = await telegramCall<{ can_connect_to_business?: boolean }>('getMe');
  return Boolean(data?.ok && data.result?.can_connect_to_business);
}

/**
 * خواندن موجودی Stars حساب Business متصل‌شده.
 * نیاز به حق can_view_gifts_and_stars روی connection.
 */
export async function fetchBusinessAccountStarBalance(
  businessConnectionId: string
): Promise<BusinessStarBalanceResult> {
  const id = String(businessConnectionId || '').trim();
  if (!id) return { ok: false, error: 'business_connection_missing', code: 'missing' };

  const data = await telegramCall<{ amount?: number; nanostar_amount?: number }>(
    'getBusinessAccountStarBalance',
    { business_connection_id: id }
  );

  if (!data) return { ok: false, error: 'telegram_unreachable', code: 'network' };
  if (!data.ok) {
    return {
      ok: false,
      error: data.description || 'telegram_rejected',
      code: 'api',
    };
  }

  const amount = Math.floor(Number(data.result?.amount ?? 0));
  if (!Number.isFinite(amount)) {
    return { ok: false, error: 'invalid_amount', code: 'parse' };
  }

  return {
    ok: true,
    amount,
    nanostarAmount:
      data.result?.nanostar_amount != null
        ? Math.floor(Number(data.result.nanostar_amount))
        : undefined,
  };
}
