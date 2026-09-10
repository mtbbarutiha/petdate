import { orderPublicIdOf, petPublicIdOf, userPublicIdOf } from '@petdate/shared';

/** Compact public ID chip — PD-* only (never numeric DB row ids). */
export function AdminIdChip({
  publicId,
  prefix,
}: {
  publicId?: string | null;
  /** @deprecated Ignored — numeric row ids are not shown in admin UI */
  numericId?: number | string;
  /** Optional label like «کاربر» shown above */
  prefix?: string;
}) {
  if (!publicId) {
    return <span className="admin-muted">—</span>;
  }
  return (
    <div className="admin-id-chip" dir="ltr">
      {prefix ? <span className="admin-id-chip-prefix">{prefix}</span> : null}
      <code className="admin-mono admin-id-public">{publicId}</code>
    </div>
  );
}

export function AdminUserId({
  user,
}: {
  user: { id: number; publicId?: string | null; name?: string };
}) {
  return <AdminIdChip publicId={userPublicIdOf(user)} />;
}

export function AdminPetId({
  pet,
}: {
  pet: { id: number; publicId?: string | null };
}) {
  return <AdminIdChip publicId={petPublicIdOf(pet)} />;
}

export function AdminOrderId({
  order,
}: {
  order: { id: number; publicId?: string | null };
}) {
  return <AdminIdChip publicId={orderPublicIdOf(order)} />;
}

/** Public user code from numeric id (and optional stored publicId). */
export function adminUserPublicCode(
  userOrId: number | { id: number; publicId?: string | null } | null | undefined,
): string | null {
  if (userOrId == null) return null;
  if (typeof userOrId === 'number') {
    if (!Number.isFinite(userOrId) || userOrId <= 0) return null;
    return userPublicIdOf({ id: userOrId });
  }
  return userPublicIdOf(userOrId);
}

/** Public pet code from numeric id (and optional stored publicId). */
export function adminPetPublicCode(
  petOrId: number | { id: number; publicId?: string | null } | null | undefined,
): string | null {
  if (petOrId == null) return null;
  if (typeof petOrId === 'number') {
    if (!Number.isFinite(petOrId) || petOrId <= 0) return null;
    return petPublicIdOf({ id: petOrId });
  }
  return petPublicIdOf(petOrId);
}

/** Public order code from numeric id (and optional stored publicId). */
export function adminOrderPublicCode(
  orderOrId: number | { id: number; publicId?: string | null } | null | undefined,
): string | null {
  if (orderOrId == null) return null;
  if (typeof orderOrId === 'number') {
    if (!Number.isFinite(orderOrId) || orderOrId <= 0) return null;
    return orderPublicIdOf({ id: orderOrId });
  }
  return orderPublicIdOf(orderOrId);
}

/** Inline public code for users/pets/orders — never `#id`. */
export function AdminEntityId({
  label,
  id,
  kind = 'raw',
}: {
  label?: string;
  id: number | string | null | undefined;
  /** Derive PD-U / PD-P / PD-O when kind is set; raw shows nothing for bare numbers */
  kind?: 'user' | 'pet' | 'order' | 'raw';
}) {
  if (id == null || id === '') {
    return <span className="admin-muted">—</span>;
  }
  let code: string | null = null;
  if (kind === 'user' && typeof id === 'number') {
    code = adminUserPublicCode(id);
  } else if (kind === 'pet' && typeof id === 'number') {
    code = adminPetPublicCode(id);
  } else if (kind === 'order' && typeof id === 'number') {
    code = adminOrderPublicCode(id);
  } else if (typeof id === 'string') {
    const upper = id.toUpperCase();
    if (upper.startsWith('PD-')) code = id;
  }
  if (!code) {
    return <span className="admin-muted">—</span>;
  }
  return (
    <span className="admin-id-inline">
      {label ? <span className="admin-muted">{label}</span> : null}
      {label ? ' ' : null}
      <code className="admin-mono admin-id-public" dir="ltr">
        {code}
      </code>
    </span>
  );
}
