import assert from 'assert';

/** Mirror of db.isDeletedOrInactiveUser — keep in sync (avoids loading full db in selftest). */
function isDeletedOrInactiveUser(user: {
  isActive?: boolean | null;
  name?: string | null;
} | null | undefined): boolean {
  if (!user) return true;
  if (user.isActive === false) return true;
  const name = String(user.name || '').trim();
  return name.startsWith('[حذف‌شده');
}

assert.equal(isDeletedOrInactiveUser(null), true);
assert.equal(isDeletedOrInactiveUser({ isActive: false, name: 'Ali' }), true);
assert.equal(isDeletedOrInactiveUser({ isActive: true, name: '[حذف‌شده #12]' }), true);
assert.equal(isDeletedOrInactiveUser({ isActive: true, name: 'سارا' }), false);
console.log('chat-inbox-gift selftest ok');
