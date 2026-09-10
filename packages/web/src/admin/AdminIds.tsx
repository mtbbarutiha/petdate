import { petPublicIdOf, userPublicIdOf } from '@petdate/shared';

/** Compact dual ID chip: public PD-* + numeric DB id (always shown). */
export function AdminIdChip({
  publicId,
  numericId,
  prefix,
}: {
  publicId?: string | null;
  numericId: number | string;
  /** Optional label like «کاربر» shown above */
  prefix?: string;
}) {
  const n = typeof numericId === 'string' ? numericId : `#${numericId}`;
  return (
    <div className="admin-id-chip" dir="ltr">
      {prefix ? <span className="admin-id-chip-prefix">{prefix}</span> : null}
      {publicId ? <code className="admin-mono admin-id-public">{publicId}</code> : null}
      <code className="admin-mono admin-id-num">{n}</code>
    </div>
  );
}

export function AdminUserId({
  user,
}: {
  user: { id: number; publicId?: string | null; name?: string };
}) {
  return (
    <AdminIdChip publicId={userPublicIdOf(user)} numericId={user.id} />
  );
}

export function AdminPetId({
  pet,
}: {
  pet: { id: number; publicId?: string | null };
}) {
  return <AdminIdChip publicId={petPublicIdOf(pet)} numericId={pet.id} />;
}

export function AdminEntityId({
  label,
  id,
}: {
  label: string;
  id: number | string | null | undefined;
}) {
  if (id == null || id === '') {
    return <span className="admin-muted">—</span>;
  }
  return (
    <span className="admin-id-inline">
      <span className="admin-muted">{label}</span>{' '}
      <code className="admin-mono" dir="ltr">
        #{id}
      </code>
    </span>
  );
}
