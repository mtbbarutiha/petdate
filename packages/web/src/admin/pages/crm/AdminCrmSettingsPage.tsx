import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CrmDeletedReasonNode, CrmSettings } from '@petdate/shared';
import { CRM_PRIORITIES } from '@petdate/shared';
import { adminCan } from '../../auth';
import { adminFetch, formatNumFa } from '../../api';
import { AdminModal } from '../../AdminModal';
import { formatAdminFaDateTime } from '../../JalaliDateSelect';
import { tr } from '../../../i18n';

type ReasonTree = Record<string, Record<string, string[]>>;
type ScoreItem = CrmSettings['scorecard'][number];

type SlaModal = { priority: string; firstMin: string; resolveHrs: string } | null;
type ReasonModal =
  | { kind: 'add-l1'; name: string }
  | { kind: 'add-l2'; l1: string; name: string }
  | { kind: 'add-leaf'; l1: string; l2: string; name: string }
  | { kind: 'rename-l1'; l1: string; name: string }
  | { kind: 'rename-l2'; l1: string; l2: string; name: string }
  | { kind: 'rename-leaf'; l1: string; l2: string; leaf: string; name: string }
  | { kind: 'delete'; path: string[]; label: string }
  | null;
type ScoreModal =
  | { kind: 'edit'; item: ScoreItem; label: string; weight: string }
  | { kind: 'add'; key: string; label: string; weight: string }
  | { kind: 'delete'; item: ScoreItem }
  | null;

const PRIO_TONE: Record<string, string> = {
  بحرانی: 'error',
  بالا: 'warn',
  متوسط: 'info',
  پایین: 'muted',
};

function cloneTree(tree: ReasonTree): ReasonTree {
  const out: ReasonTree = {};
  for (const [l1, subs] of Object.entries(tree)) {
    out[l1] = {};
    for (const [l2, leaves] of Object.entries(subs || {})) {
      out[l1][l2] = [...(leaves || [])];
    }
  }
  return out;
}

function pathKey(path: string[]): string {
  return path.join('\u0001');
}

function softDeleteFromTree(
  tree: ReasonTree,
  path: string[],
  deletedAt: string
): { tree: ReasonTree; deleted: CrmDeletedReasonNode[] } {
  const next = cloneTree(tree);
  const deleted: CrmDeletedReasonNode[] = [];
  const [l1, l2, leaf] = path;

  if (path.length === 1 && l1) {
    const block = next[l1];
    if (block) {
      deleted.push({ path: [l1], deletedAt });
      for (const [sub, leaves] of Object.entries(block)) {
        deleted.push({ path: [l1, sub], deletedAt });
        for (const lf of leaves) deleted.push({ path: [l1, sub, lf], deletedAt });
      }
      delete next[l1];
    }
  } else if (path.length === 2 && l1 && l2 && next[l1]?.[l2]) {
    deleted.push({ path: [l1, l2], deletedAt });
    for (const lf of next[l1][l2]) deleted.push({ path: [l1, l2, lf], deletedAt });
    delete next[l1][l2];
    if (!Object.keys(next[l1]).length) delete next[l1];
  } else if (path.length === 3 && l1 && l2 && leaf && next[l1]?.[l2]) {
    const leaves = next[l1][l2].filter((x) => x !== leaf);
    if (leaves.length !== next[l1][l2].length) {
      deleted.push({ path: [l1, l2, leaf], deletedAt });
      next[l1][l2] = leaves;
    }
  }
  return { tree: next, deleted };
}

function restoreDeleted(
  tree: ReasonTree,
  node: CrmDeletedReasonNode
): ReasonTree {
  const next = cloneTree(tree);
  const [l1, l2, leaf] = node.path;
  if (node.path.length === 1 && l1) {
    if (!next[l1]) next[l1] = {};
  } else if (node.path.length === 2 && l1 && l2) {
    if (!next[l1]) next[l1] = {};
    if (!next[l1][l2]) next[l1][l2] = [];
  } else if (node.path.length === 3 && l1 && l2 && leaf) {
    if (!next[l1]) next[l1] = {};
    if (!next[l1][l2]) next[l1][l2] = [];
    if (!next[l1][l2].includes(leaf)) next[l1][l2].push(leaf);
  }
  return next;
}

export function AdminCrmSettingsPage() {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showDeleted, setShowDeleted] = useState(false);

  const [slaModal, setSlaModal] = useState<SlaModal>(null);
  const [reasonModal, setReasonModal] = useState<ReasonModal>(null);
  const [scoreModal, setScoreModal] = useState<ScoreModal>(null);

  const canAdmin = adminCan('crm.admin');

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(() => {
    void adminFetch<{ settings: CrmSettings }>('/api/admin/crm/settings')
      .then((d) => {
        const s = d.settings;
        setSettings({
          ...s,
          deletedReasons: Array.isArray(s.deletedReasons) ? s.deletedReasons : [],
        });
        setError(null);
        const open: Record<string, boolean> = {};
        for (const l1 of Object.keys(s.reasonTree || {})) open[l1] = true;
        setExpanded((prev) => ({ ...open, ...prev }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا در بارگذاری'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePatch = async (patch: Partial<CrmSettings>, okMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      const d = await adminFetch<{ settings: CrmSettings }>('/api/admin/crm/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setSettings({
        ...d.settings,
        deletedReasons: Array.isArray(d.settings.deletedReasons) ? d.settings.deletedReasons : [],
      });
      flash(okMsg);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const priorities = useMemo(() => {
    if (!settings) return [] as string[];
    const keys = Object.keys(settings.slaPolicy || {});
    const ordered = CRM_PRIORITIES.filter((p) => keys.includes(p));
    for (const k of keys) if (!ordered.includes(k as (typeof CRM_PRIORITIES)[number])) ordered.push(k as (typeof CRM_PRIORITIES)[number]);
    return ordered;
  }, [settings]);

  const weightSum = useMemo(
    () => (settings?.scorecard || []).reduce((a, s) => a + Number(s.weight || 0), 0),
    [settings]
  );

  if (!settings) {
    return (
      <div className="admin-page">
        <p>{tr('در حال بارگذاری…')}</p>
        {error ? <p className="admin-error">{error}</p> : null}
      </div>
    );
  }

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const submitSla = async (e: FormEvent) => {
    e.preventDefault();
    if (!slaModal) return;
    const first = Math.max(1, Math.round(Number(slaModal.firstMin) || 0));
    const resolve = Math.max(1, Math.round(Number(slaModal.resolveHrs) || 0));
    const slaPolicy = { ...settings.slaPolicy, [slaModal.priority]: [first, resolve] as [number, number] };
    if (await savePatch({ slaPolicy }, 'سیاست SLA ذخیره شد')) setSlaModal(null);
  };

  const submitReason = async (e: FormEvent) => {
    e.preventDefault();
    if (!reasonModal) return;
    const tree = cloneTree(settings.reasonTree);
    const deletedReasons = [...(settings.deletedReasons || [])];
    const name = 'name' in reasonModal ? reasonModal.name.trim() : '';

    if (reasonModal.kind === 'delete') {
      const { tree: next, deleted } = softDeleteFromTree(tree, reasonModal.path, new Date().toISOString());
      if (await savePatch({ reasonTree: next, deletedReasons: [...deleted, ...deletedReasons] }, 'گره حذف نرم شد')) {
        setReasonModal(null);
      }
      return;
    }

    if (!name) {
      setError(tr('نام الزامی است'));
      return;
    }

    if (reasonModal.kind === 'add-l1') {
      if (tree[name]) {
        setError(tr('این دسته از قبل وجود دارد'));
        return;
      }
      tree[name] = {};
    } else if (reasonModal.kind === 'add-l2') {
      if (!tree[reasonModal.l1]) tree[reasonModal.l1] = {};
      if (tree[reasonModal.l1][name]) {
        setError(tr('این زیردسته از قبل وجود دارد'));
        return;
      }
      tree[reasonModal.l1][name] = [];
    } else if (reasonModal.kind === 'add-leaf') {
      const leaves = tree[reasonModal.l1]?.[reasonModal.l2] || [];
      if (leaves.includes(name)) {
        setError(tr('این برگ از قبل وجود دارد'));
        return;
      }
      if (!tree[reasonModal.l1]) tree[reasonModal.l1] = {};
      tree[reasonModal.l1][reasonModal.l2] = [...leaves, name];
    } else if (reasonModal.kind === 'rename-l1') {
      if (reasonModal.l1 === name) {
        setReasonModal(null);
        return;
      }
      if (tree[name]) {
        setError(tr('نام تکراری است'));
        return;
      }
      tree[name] = tree[reasonModal.l1] || {};
      delete tree[reasonModal.l1];
    } else if (reasonModal.kind === 'rename-l2') {
      const block = tree[reasonModal.l1];
      if (!block) return;
      if (reasonModal.l2 === name) {
        setReasonModal(null);
        return;
      }
      if (block[name]) {
        setError(tr('نام تکراری است'));
        return;
      }
      block[name] = block[reasonModal.l2] || [];
      delete block[reasonModal.l2];
    } else if (reasonModal.kind === 'rename-leaf') {
      const leaves = tree[reasonModal.l1]?.[reasonModal.l2] || [];
      if (reasonModal.leaf === name) {
        setReasonModal(null);
        return;
      }
      if (leaves.includes(name)) {
        setError(tr('نام تکراری است'));
        return;
      }
      tree[reasonModal.l1][reasonModal.l2] = leaves.map((x) => (x === reasonModal.leaf ? name : x));
    }

    if (await savePatch({ reasonTree: tree }, 'درخت دلایل به‌روز شد')) setReasonModal(null);
  };

  const restoreNode = async (node: CrmDeletedReasonNode) => {
    const nextTree = restoreDeleted(settings.reasonTree, node);
    const deletedReasons = (settings.deletedReasons || []).filter((d) => pathKey(d.path) !== pathKey(node.path));
    await savePatch({ reasonTree: nextTree, deletedReasons }, 'گره بازیابی شد');
  };

  const submitScore = async (e: FormEvent) => {
    e.preventDefault();
    if (!scoreModal) return;
    let scorecard = [...settings.scorecard];

    if (scoreModal.kind === 'delete') {
      scorecard = scorecard.filter((s) => s.key !== scoreModal.item.key);
      if (await savePatch({ scorecard }, 'معیار حذف شد')) setScoreModal(null);
      return;
    }

    const label = scoreModal.label.trim();
    const weight = Math.max(0, Math.round(Number(scoreModal.weight) || 0));
    if (!label) {
      setError(tr('عنوان الزامی است'));
      return;
    }

    if (scoreModal.kind === 'add') {
      const key = scoreModal.key.trim().replace(/\s+/g, '_') || `q_${Date.now().toString(36)}`;
      if (scorecard.some((s) => s.key === key)) {
        setError(tr('کلید تکراری است'));
        return;
      }
      scorecard.push({ key, label, weight });
    } else {
      scorecard = scorecard.map((s) =>
        s.key === scoreModal.item.key ? { ...s, label, weight } : s
      );
    }
    if (await savePatch({ scorecard }, 'اسکورکارت ذخیره شد')) setScoreModal(null);
  };

  const reasonModalTitle =
    reasonModal?.kind === 'add-l1'
      ? 'افزودن دسته'
      : reasonModal?.kind === 'add-l2'
        ? 'افزودن زیردسته'
        : reasonModal?.kind === 'add-leaf'
          ? 'افزودن دلیل'
          : reasonModal?.kind === 'delete'
            ? 'حذف نرم گره'
            : reasonModal
              ? 'ویرایش نام'
              : '';

  return (
    <div className="admin-page crm-settings-page">
      <header className="admin-header">
        <div>
          <h1>{tr('تنظیمات امور مشتریان')}</h1>
          <p>{tr('SLA · دلایل · اسکورکارت')}</p>
        </div>
        {canAdmin ? (
          <button
            type="button"
            className="admin-btn"
            disabled={busy}
            onClick={() =>
              void adminFetch('/api/admin/crm/sla/watch', { method: 'POST', body: '{}' })
                .then(() => flash('ناظر SLA اجرا شد'))
                .catch((e) => setError(e instanceof Error ? e.message : 'خطا'))
            }
          >
            {tr('اجرای ناظر SLA')}
          </button>
        ) : null}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {toast ? <div className="crm-settings-toast">{toast}</div> : null}

      {/* ── SLA ── */}
      <section className="admin-card">
        <div className="admin-card-head">
          <h2>{tr('سیاست SLA')}</h2>
          <span className="admin-muted">{tr('پاسخ اول (دقیقه) · حل (ساعت)')}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr('اولویت')}</th>
                <th>{tr('پاسخ اول')}</th>
                <th>{tr('حل')}</th>
                {canAdmin ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {priorities.map((p) => {
                const [first, resolve] = settings.slaPolicy[p] || [0, 0];
                return (
                  <tr key={p}>
                    <td>
                      <span className={`tk-tag tk-tag--${PRIO_TONE[p] || 'muted'}`}>{p}</span>
                    </td>
                    <td>{formatNumFa(first)} {tr('دقیقه')}</td>
                    <td>{formatNumFa(resolve)} {tr('ساعت')}</td>
                    {canAdmin ? (
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--ghost"
                          onClick={() =>
                            setSlaModal({
                              priority: p,
                              firstMin: String(first),
                              resolveHrs: String(resolve),
                            })
                          }
                        >
                          {tr('ویرایش')}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Reasons tree ── */}
      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <h2>{tr('درخت دلایل')}</h2>
          {canAdmin ? (
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--primary"
              onClick={() => setReasonModal({ kind: 'add-l1', name: '' })}
            >
              {tr('دسته جدید')}
            </button>
          ) : null}
        </div>
        <div className="crm-reason-tree">
          {Object.keys(settings.reasonTree).length === 0 ? (
            <p className="admin-muted">{tr('درختی تعریف نشده است.')}</p>
          ) : null}
          {Object.entries(settings.reasonTree).map(([l1, subs]) => (
            <div key={l1} className="crm-reason-node crm-reason-node--l1">
              <div className="crm-reason-row">
                <button type="button" className="crm-reason-toggle" onClick={() => toggle(l1)} aria-expanded={!!expanded[l1]}>
                  <span className="crm-reason-chevron">{expanded[l1] ? '▾' : '◂'}</span>
                  <strong>{l1}</strong>
                  <span className="admin-muted">{formatNumFa(Object.keys(subs || {}).length)} {tr('زیردسته')}</span>
                </button>
                {canAdmin ? (
                  <div className="crm-reason-actions">
                    <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setReasonModal({ kind: 'add-l2', l1, name: '' })}>
                      {tr('زیردسته')}
                    </button>
                    <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setReasonModal({ kind: 'rename-l1', l1, name: l1 })}>
                      {tr('ویرایش')}
                    </button>
                    <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setReasonModal({ kind: 'delete', path: [l1], label: l1 })}>
                      {tr('حذف')}
                    </button>
                  </div>
                ) : null}
              </div>
              {expanded[l1]
                ? Object.entries(subs || {}).map(([l2, leaves]) => {
                    const l2key = `${l1}\u0001${l2}`;
                    return (
                      <div key={l2key} className="crm-reason-node crm-reason-node--l2">
                        <div className="crm-reason-row">
                          <button type="button" className="crm-reason-toggle" onClick={() => toggle(l2key)} aria-expanded={!!expanded[l2key]}>
                            <span className="crm-reason-chevron">{expanded[l2key] ? '▾' : '◂'}</span>
                            <span>{l2}</span>
                            <span className="admin-muted">{formatNumFa((leaves || []).length)} {tr('مورد')}</span>
                          </button>
                          {canAdmin ? (
                            <div className="crm-reason-actions">
                              <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setReasonModal({ kind: 'add-leaf', l1, l2, name: '' })}>
                                {tr('دلیل')}
                              </button>
                              <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setReasonModal({ kind: 'rename-l2', l1, l2, name: l2 })}>
                                {tr('ویرایش')}
                              </button>
                              <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setReasonModal({ kind: 'delete', path: [l1, l2], label: l2 })}>
                                {tr('حذف')}
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {expanded[l2key] ? (
                          <ul className="crm-reason-leaves">
                            {(leaves || []).map((leaf) => (
                              <li key={`${l2key}\u0001${leaf}`} className="crm-reason-row crm-reason-row--leaf">
                                <span className="crm-reason-leaf-label">{leaf}</span>
                                {canAdmin ? (
                                  <div className="crm-reason-actions">
                                    <button
                                      type="button"
                                      className="admin-btn admin-btn--sm admin-btn--ghost"
                                      onClick={() => setReasonModal({ kind: 'rename-leaf', l1, l2, leaf, name: leaf })}
                                    >
                                      {tr('ویرایش')}
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-btn admin-btn--sm admin-btn--ghost"
                                      onClick={() => setReasonModal({ kind: 'delete', path: [l1, l2, leaf], label: leaf })}
                                    >
                                      {tr('حذف')}
                                    </button>
                                  </div>
                                ) : null}
                              </li>
                            ))}
                            {!(leaves || []).length ? <li className="admin-muted">{tr('بدون برگ')}</li> : null}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>
          ))}
        </div>

        {(settings.deletedReasons || []).length ? (
          <div className="crm-reason-deleted">
            <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={() => setShowDeleted((v) => !v)}>
              {showDeleted ? tr('بستن') : tr('نمایش')} {tr('حذف‌شده‌ها (')}{formatNumFa(settings.deletedReasons.length)})
            </button>
            {showDeleted ? (
              <ul className="crm-reason-deleted-list">
                {settings.deletedReasons.map((d) => (
                  <li key={pathKey(d.path)}>
                    <span>{d.path.join(' ← ')}</span>
                    <span className="admin-muted">{formatAdminFaDateTime(d.deletedAt)}</span>
                    {canAdmin ? (
                      <button type="button" className="admin-btn admin-btn--sm" disabled={busy} onClick={() => void restoreNode(d)}>
                        {tr('بازیابی')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ── Scorecard ── */}
      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head">
          <h2>{tr('اسکورکارت QA')}</h2>
          <span className={`admin-muted${weightSum !== 100 ? ' crm-settings-weight-warn' : ''}`}>
            {tr('مجموع وزن:')} {formatNumFa(weightSum)}
            {weightSum !== 100 ? tr(' (پیشنهادی ۱۰۰)') : ''}
          </span>
          {canAdmin ? (
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--primary"
              onClick={() => setScoreModal({ kind: 'add', key: '', label: '', weight: '10' })}
            >
              {tr('معیار جدید')}
            </button>
          ) : null}
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr('کلید')}</th>
                <th>{tr('عنوان')}</th>
                <th>{tr('وزن')}</th>
                {canAdmin ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {settings.scorecard.map((s) => (
                <tr key={s.key}>
                  <td className="crm-settings-mono" dir="ltr">
                    {s.key}
                  </td>
                  <td>{tr(s.label)}</td>
                  <td>{formatNumFa(s.weight)}</td>
                  {canAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--ghost"
                        onClick={() =>
                          setScoreModal({
                            kind: 'edit',
                            item: s,
                            label: s.label,
                            weight: String(s.weight),
                          })
                        }
                      >
                        {tr('ویرایش')}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--ghost"
                        onClick={() => setScoreModal({ kind: 'delete', item: s })}
                      >
                        {tr('حذف')}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      <AdminModal
        open={!!slaModal}
        title={slaModal ? `${tr('ویرایش SLA · ')}${slaModal.priority}` : ''}
        onClose={() => !busy && setSlaModal(null)}
        size="sm"
        as="form"
        busy={busy}
        onSubmit={(e) => void submitSla(e)}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              {tr('ذخیره')}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setSlaModal(null)}>
              {tr('انصراف')}
            </button>
          </>
        }
      >
        {slaModal ? (
          <>
            <label>
              <span className="form-label">{tr('پاسخ اول (دقیقه)')}</span>
              <input
                className="form-input"
                type="number"
                min={1}
                required
                value={slaModal.firstMin}
                onChange={(e) => setSlaModal({ ...slaModal, firstMin: e.target.value })}
              />
            </label>
            <label>
              <span className="form-label">{tr('حل (ساعت)')}</span>
              <input
                className="form-input"
                type="number"
                min={1}
                required
                value={slaModal.resolveHrs}
                onChange={(e) => setSlaModal({ ...slaModal, resolveHrs: e.target.value })}
              />
            </label>
          </>
        ) : null}
      </AdminModal>

      <AdminModal
        open={!!reasonModal}
        title={reasonModalTitle}
        onClose={() => !busy && setReasonModal(null)}
        size="sm"
        as="form"
        busy={busy}
        onSubmit={(e) => void submitReason(e)}
        footer={
          <>
            <button
              type="submit"
              className={`admin-btn ${reasonModal?.kind === 'delete' ? 'admin-btn--danger' : 'admin-btn--primary'}`}
              disabled={busy}
            >
              {reasonModal?.kind === 'delete' ? 'حذف نرم' : 'ذخیره'}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setReasonModal(null)}>
              {tr('انصراف')}
            </button>
          </>
        }
      >
        {reasonModal?.kind === 'delete' ? (
          <p>
            «{tr(reasonModal.label)}{tr('» از درخت فعال حذف می‌شود اما برای یکپارچگی گزارش‌ها نگه داشته می‌شود و قابل بازیابی است.')}
          </p>
        ) : reasonModal ? (
          <label>
            <span className="form-label">{tr('نام')}</span>
            <input
              className="form-input"
              required
              value={'name' in reasonModal ? reasonModal.name : ''}
              onChange={(e) =>
                setReasonModal(
                  reasonModal && 'name' in reasonModal ? { ...reasonModal, name: e.target.value } : reasonModal
                )
              }
            />
          </label>
        ) : null}
      </AdminModal>

      <AdminModal
        open={!!scoreModal}
        title={
          scoreModal?.kind === 'add'
            ? tr('معیار جدید')
            : scoreModal?.kind === 'delete'
              ? tr('حذف معیار')
              : scoreModal
                ? tr('ویرایش معیار')
                : ''
        }
        onClose={() => !busy && setScoreModal(null)}
        size="sm"
        as="form"
        busy={busy}
        onSubmit={(e) => void submitScore(e)}
        footer={
          <>
            <button
              type="submit"
              className={`admin-btn ${scoreModal?.kind === 'delete' ? 'admin-btn--danger' : 'admin-btn--primary'}`}
              disabled={busy}
            >
              {scoreModal?.kind === 'delete' ? 'حذف' : 'ذخیره'}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setScoreModal(null)}>
              {tr('انصراف')}
            </button>
          </>
        }
      >
        {scoreModal?.kind === 'delete' ? (
          <p>{tr('معیار «')}{tr(scoreModal.item.label)}{tr('» از اسکورکارت حذف شود؟')}</p>
        ) : scoreModal ? (
          <>
            {scoreModal.kind === 'add' ? (
              <label>
                <span className="form-label">{tr('کلید (لاتین، اختیاری)')}</span>
                <input
                  className="form-input"
                  dir="ltr"
                  placeholder={tr("مثلاً greeting")}
                  value={scoreModal.key}
                  onChange={(e) => setScoreModal({ ...scoreModal, key: e.target.value })}
                />
              </label>
            ) : (
              <p className="admin-muted">
                {tr('کلید:')} <span dir="ltr">{scoreModal.item.key}</span>
              </p>
            )}
            <label>
              <span className="form-label">{tr('عنوان')}</span>
              <input
                className="form-input"
                required
                value={tr(scoreModal.label)}
                onChange={(e) => setScoreModal({ ...scoreModal, label: e.target.value })}
              />
            </label>
            <label>
              <span className="form-label">{tr('وزن')}</span>
              <input
                className="form-input"
                type="number"
                min={0}
                required
                value={scoreModal.weight}
                onChange={(e) => setScoreModal({ ...scoreModal, weight: e.target.value })}
              />
            </label>
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}

export default AdminCrmSettingsPage;
