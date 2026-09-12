import { useEffect, useRef } from 'react';
import { FACE_VERIFY_REWARD, formatFaInt } from '@petdate/shared';
import { useAppToast } from '../hooks/useAppToast';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';

/**
 * When /me flips pending → verified (admin approved), toast success + 100 coins.
 * Telegram users also get a bot DM from the API approve path.
 */
export function FaceVerifyRewardToast() {
  const { user } = useAuthStore();
  const { toastSuccess } = useAppToast();
  const { t, lang } = useI18n();
  const prevStatus = useRef(user?.verificationStatus);

  useEffect(() => {
    const next = user?.verificationStatus;
    const prev = prevStatus.current;
    prevStatus.current = next;
    if (!user?.id || prev !== 'pending' || next !== 'verified') return;
    const key = `pd_face_verify_toast_${user.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* private mode */
    }
    const n = lang === 'en' ? String(FACE_VERIFY_REWARD) : formatFaInt(FACE_VERIFY_REWARD);
    toastSuccess(t('verify.approvedToast', { n }));
  }, [user?.id, user?.verificationStatus, t, toastSuccess, lang]);

  return null;
}
