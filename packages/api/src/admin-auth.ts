/**
 * Admin auth actors + permission guards.
 * Extends ADMIN_PASSWORD session without breaking existing login.
 */
import type { NextFunction, Request, Response } from 'express';
import { roleHasPermission, type AdminPermission } from '@petdate/shared';
import { actorHasPermission, resolveAdminActor, type AdminAuthActor } from './hr-service';

export type { AdminAuthActor };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminActor?: AdminAuthActor;
    }
  }
}

function passwordFromReq(req: Request): string {
  const header = req.header('x-admin-password') || '';
  const bodyPwd =
    req.body && typeof req.body === 'object' && typeof (req.body as { password?: string }).password === 'string'
      ? (req.body as { password: string }).password
      : '';
  return (header || bodyPwd).trim();
}

function usernameFromReq(req: Request): string | undefined {
  const header = req.header('x-admin-username') || '';
  const bodyUser =
    req.body && typeof req.body === 'object' && typeof (req.body as { username?: string }).username === 'string'
      ? (req.body as { username: string }).username
      : '';
  const u = (header || bodyUser).trim();
  return u || undefined;
}

/** Resolve actor from password (and optional username). */
export function authenticateAdminRequest(req: Request): AdminAuthActor | null {
  const password = passwordFromReq(req);
  if (!password) return null;
  return resolveAdminActor({ password, username: usernameFromReq(req) });
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/auth/login' && req.method === 'POST') {
    next();
    return;
  }
  const actor = authenticateAdminRequest(req);
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  req.adminActor = actor;
  next();
}

export function requirePermission(...permissions: AdminPermission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const actor = req.adminActor;
    if (!actor) {
      res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
      return;
    }
    const ok = permissions.every(
      (p) =>
        actorHasPermission(actor, p) ||
        roleHasPermission(actor.role, p, actor.permissions)
    );
    if (!ok) {
      res.status(403).json({ error: 'سطح دسترسی کافی نیست' });
      return;
    }
    next();
  };
}
