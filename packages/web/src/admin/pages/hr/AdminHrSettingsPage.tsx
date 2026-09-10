import { Link } from 'react-router-dom';
import { adminCan } from '../../auth';
import { HrLinkGrid } from './HrUi';

export function AdminHrSettingsPage() {
  const canRbac = adminCan('admin.full');
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>تنظیمات HR · پیکربندی</h1><p>پیوند — تنظیمات اختصاصی منابع انسانی و پیوند به RBAC</p></div>
      </header>
      <HrLinkGrid links={[
        { to: '/admin/hr/compensation', label: 'مدل‌های جبران خدمت', sub: 'ثابت / متغیر' },
        { to: '/admin/hr/career', label: 'مسیر شغلی و مزایا', sub: 'لایه‌ها و Benefit Engine' },
        { to: '/admin/hr/employees', label: 'لوکاپ‌های پرونده', sub: 'شغل، محل، نحوه همکاری' },
        ...(canRbac ? [{ to: '/admin/hr/rbac', label: 'نقش‌ها و دسترسی (RBAC)', sub: 'حساب اپراتور و مجوزها' }] : []),
      ]} />
      <article className="admin-card" style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>نگاشت مهاجرت به Admin Panel</h2>
        <ul className="admin-log-list">
          {['نقش‌ها و دسترسی‌ها','پیکربندی گردش‌کار','قالب‌های اعلان','قالب‌های ایمیل/پیامک','لوکاپ‌های عمومی','Integrations','سیاست Audit'].map((c) => (
            <li key={c}><b>{c}</b> · منابع انسانی → Admin Panel</li>
          ))}
        </ul>
        {canRbac ? <p style={{ marginTop: 12 }}><Link to="/admin/hr/rbac">مدیریت نقش‌ها →</Link></p> : null}
      </article>
    </div>
  );
}
