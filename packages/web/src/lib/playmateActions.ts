import { PET_SPECIES_LABELS, PLAYDATE_REQUEST_COST, type PetProfile } from '@petdate/shared';
import { createPlaydateRequest, findPlaymatesRequest } from './api';

export type FindPlaymateResult = {
  sent: number;
  skipped: number;
  speciesLabel: string;
  sampleLine?: string;
  sourceName: string;
  cost: number;
  coins?: number;
};

/** ارسال یک درخواست همبازی — مثل ربات، بدون پیام اختیاری (۲ سکه) */
export async function sendPlaymateRequestNow(opts: {
  fromPetId: number;
  toPetId: number;
  fromUserId: number;
  confirmResend?: boolean;
}) {
  try {
    return await createPlaydateRequest({
      fromPetId: opts.fromPetId,
      toPetId: opts.toPetId,
      fromUserId: opts.fromUserId,
      confirmResend: opts.confirmResend,
    });
  } catch (err) {
    const needsConfirm =
      err instanceof Error &&
      ((err as Error & { requiresResendConfirm?: boolean }).requiresResendConfirm ||
        /میخوای مجدد/.test(err.message));
    if (!opts.confirmResend && needsConfirm) {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm('میخوای مجدد درخواست بدی به اون شخص؟');
      if (!ok) throw err;
      return createPlaydateRequest({
        fromPetId: opts.fromPetId,
        toPetId: opts.toPetId,
        fromUserId: opts.fromUserId,
        confirmResend: true,
      });
    }
    throw err;
  }
}

/**
 * پیدا کردن همبازی مثل ربات:
 * پت مبدأ → یک‌بار ۲ سکه → ارسال خودکار درخواست‌ها از API
 */
export async function findAndSendPlaymates(
  source: PetProfile,
  fromUserId: number
): Promise<FindPlaymateResult> {
  const result = await findPlaymatesRequest({
    fromPetId: source.id,
    fromUserId,
  });
  const speciesLabel =
    result.speciesLabel || PET_SPECIES_LABELS[source.species] || source.species;

  return {
    sent: result.sent,
    skipped: result.skipped,
    speciesLabel,
    sampleLine: result.sampleLine,
    sourceName: result.sourceName || source.name,
    cost: result.cost ?? (result.sent > 0 ? PLAYDATE_REQUEST_COST : 0),
    coins: result.coins,
  };
}

export { PLAYDATE_REQUEST_COST };
