import { Suspense, useLayoutEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminPageLoading } from './AdminPageLoading';

/** Signals that the new lazy page mounted so AdminLayout can drop the overlay. */
function AdminOutletReady({
  pathname,
  onReady,
  children,
}: {
  pathname: string;
  onReady: (path: string) => void;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    onReady(pathname);
  }, [onReady, pathname]);
  return children;
}

/**
 * Admin route body: nested Suspense (lazy pages) + pathname overlay so
 * React Router 7 startTransition cannot keep painting the previous page.
 */
export function AdminRouteOutlet() {
  const { pathname } = useLocation();
  const [readyPath, setReadyPath] = useState(pathname);
  const pending = readyPath !== pathname;

  useLayoutEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setReadyPath(pathname), 2500);
    return () => window.clearTimeout(timer);
  }, [pending, pathname]);

  return (
    <div className="admin-outlet" aria-busy={pending}>
      {pending ? <AdminPageLoading overlay /> : null}
      <div
        className={`admin-outlet-page${pending ? ' is-pending' : ''}`}
        aria-hidden={pending || undefined}
      >
        <Suspense fallback={<AdminPageLoading />} key={pathname}>
          <AdminOutletReady pathname={pathname} onReady={setReadyPath}>
            <Outlet />
          </AdminOutletReady>
        </Suspense>
      </div>
    </div>
  );
}
