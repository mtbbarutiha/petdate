import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { UserRole } from '@petdate/shared';
import { USER_ROLE_LABELS, dashboardPathForRole } from '@petdate/shared';
import { AuthShell } from '../../components/AuthShell';
import { useUserStore } from '../../hooks/useUserStore';

interface WizardStep {
  title: string;
  fields: { key: string; label: string; placeholder: string }[];
}

const WIZARD_STEPS: Partial<Record<UserRole, WizardStep[]>> = {
  pet_owner: [
    {
      title: 'اطلاعات اولیه',
      fields: [
        { key: 'city', label: 'شهر', placeholder: 'مثلاً: تهران' },
        { key: 'neighborhood', label: 'محله', placeholder: 'مثلاً: ونک' },
      ],
    },
  ],
  vet: [
    {
      title: 'پروفایل دامپزشک',
      fields: [
        { key: 'clinic', label: 'نام کلینیک', placeholder: 'کلینیک شما' },
        { key: 'specialty', label: 'تخصص', placeholder: 'مثلاً: جراحی' },
      ],
    },
  ],
  no_pet: [
    {
      title: 'علاقه‌مندی‌ها',
      fields: [
        { key: 'interest', label: 'چه حیوانی دوست داری؟', placeholder: 'سگ، گربه، ...' },
      ],
    },
  ],
  pet_seeker: [
    {
      title: 'دنبال چه پتی هستی؟',
      fields: [
        { key: 'species', label: 'نوع حیوان', placeholder: 'سگ، گربه، ...' },
        { key: 'size', label: 'سایز ترجیحی', placeholder: 'کوچک، متوسط، بزرگ' },
      ],
    },
  ],
  trainer: [
    {
      title: 'پروفایل مربی',
      fields: [
        { key: 'specialty', label: 'تخصص آموزشی', placeholder: 'آموزش سگ، رفتارشناسی' },
        { key: 'experience', label: 'سابقه (سال)', placeholder: '۳' },
      ],
    },
  ],
};

export function RoleWizardPage() {
  const { role } = useParams<{ role: UserRole }>();
  const navigate = useNavigate();
  const { saveOnboardingToApi } = useUserStore();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!role || !WIZARD_STEPS[role]) {
    navigate('/onboarding/role', { replace: true });
    return null;
  }

  const steps = WIZARD_STEPS[role]!;
  const step = steps[0];

  const handleComplete = async () => {
    setSaving(true);
    try {
      if (role === 'pet_owner') {
        await saveOnboardingToApi('profile_incomplete');
        navigate('/onboarding/pet', { replace: true });
        return;
      }
      await saveOnboardingToApi('profile_complete');
      navigate(dashboardPathForRole(role), { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await saveOnboardingToApi('profile_incomplete');
      navigate(dashboardPathForRole(role), { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      wide
      backTo="/onboarding/role"
      backLabel="بازگشت به انتخاب نقش"
      bannerTitle={USER_ROLE_LABELS[role]}
      bannerLead="اطلاعات پایه را وارد کن — می‌تونی فعلاً رد کنی"
      bannerImage="/pepito/uploads/06.jpg"
    >
      <p className="pepito-auth-kicker">{USER_ROLE_LABELS[role]}</p>
      <h1>{step.title}</h1>
      <p className="auth-lead">اطلاعات پایه رو وارد کن — می‌تونی فعلاً رد کنی و بعداً تکمیل کنی</p>

      <form
        className="auth-form wizard-form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleComplete();
        }}
      >
        {step.fields.map((field) => (
          <div key={field.key} className="form-group">
            <label className="form-label">{field.label}</label>
            <input
              className="form-input"
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </div>
        ))}

        <button type="submit" className="pepito-btn button-1 auth-submit" disabled={saving}>
          {role === 'pet_owner' ? 'مرحله بعد — ثبت پت' : 'شروع استفاده از Pet Date'}
        </button>
        <button
          type="button"
          className="pepito-btn pepito-btn--ghost auth-skip-btn"
          onClick={() => void handleSkip()}
          disabled={saving}
        >
          ⏭ فعلاً رد کن
        </button>
      </form>
    </AuthShell>
  );
}
