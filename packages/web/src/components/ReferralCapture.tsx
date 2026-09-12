import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureReferralFromLocation } from '../lib/referral';

/** Persist invite `ref` from any landing URL so OTP / Telegram login can attribute. */
export function ReferralCapture() {
  const location = useLocation();
  useEffect(() => {
    captureReferralFromLocation(location.search, location.pathname);
  }, [location.search, location.pathname]);
  return null;
}
