/** Path matching for admin sidebar active group / page title. No UI imports. */

export function matchAdminNavPath(to: string, pathname: string): boolean {
  return pathname === to || (to !== '/admin' && pathname.startsWith(`${to}/`));
}

export function findLongestNavMatch<T extends { to: string }>(
  pathname: string,
  items: T[]
): T | undefined {
  let best: T | undefined;
  let bestLen = -1;
  for (const it of items) {
    if (matchAdminNavPath(it.to, pathname) && it.to.length > bestLen) {
      best = it;
      bestLen = it.to.length;
    }
  }
  return best;
}
