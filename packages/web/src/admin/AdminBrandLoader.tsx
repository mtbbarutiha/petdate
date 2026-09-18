import { BRAND } from '@petdate/shared';
import { BRAND_MARK } from '../data/petImages';
import { useI18n } from '../i18n';

export type AdminBrandLoaderSize = 'page' | 'card';

type Props = {
  /** Full route wait, or a compact chart/section wait. Same motion. */
  size?: AdminBrandLoaderSize;
  className?: string;
};

/**
 * Admin wait state: the real Pet Date mark (dog + cat heart) with a soft
 * pulse and a thin brand-purple ring. Not a generic spinner or skeleton.
 */
export function AdminBrandLoader({ size = 'page', className = '' }: Props) {
  const { t } = useI18n();
  return (
    <div
      className={`admin-brand-loader admin-brand-loader--${size}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="admin-brand-loader-sr">{t('admin.loading')}</span>
      <div className="admin-brand-loader-stage" aria-hidden>
        <span className="admin-brand-loader-ring" />
        <img
          src={BRAND_MARK}
          alt=""
          className="admin-brand-loader-mark"
          draggable={false}
        />
      </div>
      <p className="admin-brand-loader-word" aria-hidden>
        {BRAND.displayNameFa}
      </p>
    </div>
  );
}
