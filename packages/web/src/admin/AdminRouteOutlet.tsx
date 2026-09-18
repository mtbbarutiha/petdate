import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { tr } from '../i18n';
import {
  adminFetchWatchSnapshot,
  armAdminFetchWatch,
  subscribeAdminFetchWatch,
} from './api';
import { AdminPageLoading } from './AdminPageLoading';

const MIN_VISIBLE_MS = 280;
const FETCH_GRACE_MS = 400;
/** Stop blocking if a request never settles; the page (or this alert) shows the failure. */
const LOAD_TIMEOUT_MS = 12000;

/**
 * Admin route body: nested Suspense (lazy pages) + pathname overlay so
 * React Router 7 startTransition cannot keep painting the previous page.
 * The overlay stays until this route's adminFetch calls settle (content ready),
 * then hides. A hung request reveals the page with an error after LOAD_TIMEOUT_MS.
 */
export function AdminRouteOutlet() {
  const { pathname } = useLocation();
  const [readyPath, setReadyPath] = useState(pathname);
  const [timedOutPath, setTimedOutPath] = useState<string | null>(null);
  const pending = readyPath !== pathname;
  const timedOut = timedOutPath === pathname;
  const watchGenRef = useRef(0);
  const armedPathRef = useRef<string | null>(null);
  if (armedPathRef.current !== pathname) {
    armedPathRef.current = pathname;
    watchGenRef.current = armAdminFetchWatch();
  }

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const gen = watchGenRef.current;
    const startedAt = Date.now();
    let finishTimer = 0;

    const finish = () => {
      if (cancelled) return;
      window.clearTimeout(finishTimer);
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      finishTimer = window.setTimeout(() => {
        if (cancelled) return;
        const snap = adminFetchWatchSnapshot(gen);
        if (snap.open > 0) return;
        setReadyPath(pathname);
      }, wait);
    };

    const unsub = subscribeAdminFetchWatch(() => {
      const snap = adminFetchWatchSnapshot(gen);
      if (snap.started > 0 && snap.open === 0) finish();
    });

    const grace = window.setTimeout(() => {
      const snap = adminFetchWatchSnapshot(gen);
      if (snap.started === 0 && snap.open === 0) finish();
    }, FETCH_GRACE_MS);

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setTimedOutPath(pathname);
      setReadyPath(pathname);
    }, LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(grace);
      window.clearTimeout(timeout);
      window.clearTimeout(finishTimer);
    };
  }, [pending, pathname]);

  return (
    <div className="admin-outlet" aria-busy={pending}>
      {pending ? <AdminPageLoading overlay /> : null}
      {timedOut ? (
        <p className="admin-route-timeout" role="alert">
          {tr('بارگذاری این صفحه طول کشید. اگر داده نیامد، دوباره وارد این بخش شوید.')}
        </p>
      ) : null}
      <div
        className={`admin-outlet-page${pending ? ' is-pending' : ''}`}
        aria-hidden={pending || undefined}
      >
        <Suspense fallback={<AdminPageLoading />} key={pathname}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
