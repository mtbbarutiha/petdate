/**
 * Staff / Grok-agent roster for the existing admin RBAC stack.
 *
 * Public chat faces stay in TEAM_AGENTS (do not add ops-only staff there).
 * This module is the single list of panel roles + one admin account per agent.
 */
import type { AdminPermission } from './hr';
import { ADMIN_ROLE_PERMISSIONS } from './hr';
import { TEAM_AGENTS } from './team-agents';

export const STAFF_PERSONNEL_PREFIX = 'STAFF-';

/** Dev/placeholder only — same token as ADMIN_SEED_PASSWORD demo accounts. Never a production secret. */
export const DEFAULT_DEV_STAFF_PASSWORD = 'petdate-seed';

export const STAFF_ROLE_KEYS = [
  'veterinarian',
  'support',
  'trainer',
  'designer',
  'social',
  'shop_procurement',
  'content_editor',
] as const;
export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

export const CLINICAL_STAFF_ROLE_KEYS = ['veterinarian', 'trainer'] as const;

export function isClinicalStaffRole(role: string | null | undefined): boolean {
  return (CLINICAL_STAFF_ROLE_KEYS as readonly string[]).includes(String(role || ''));
}

/** Least-privilege claims per staff role. `support` reuses the built-in support pack. */
export const STAFF_ROLE_PERMISSIONS: Record<StaffRoleKey, readonly AdminPermission[]> = {
  veterinarian: ['platform.read', 'content.read', 'content.write'],
  support: ADMIN_ROLE_PERMISSIONS.support,
  trainer: ['platform.read'],
  designer: ['content.read', 'content.write'],
  social: ['content.read', 'content.write', 'content.create', 'platform.read'],
  shop_procurement: ['shop.read', 'shop.write', 'shop.create'],
  content_editor: ['content.read', 'content.write', 'content.create'],
};

export type StaffRoleSeedDef = {
  key: StaffRoleKey;
  nameFa: string;
  description: string;
  permissions: readonly AdminPermission[];
};

export const STAFF_ROLE_DEFS: readonly StaffRoleSeedDef[] = [
  {
    key: 'veterinarian',
    nameFa: 'دامپزشک',
    description: 'مشاوره بالینی و محتوای پزشکی مجله — بدون تنظیمات پلتفرم',
    permissions: STAFF_ROLE_PERMISSIONS.veterinarian,
  },
  {
    key: 'support',
    nameFa: 'پشتیبانی',
    description: 'تیکت، اینباکس پشتیبانی و کمک به کاربران',
    permissions: STAFF_ROLE_PERMISSIONS.support,
  },
  {
    key: 'trainer',
    nameFa: 'مربی',
    description: 'مشاهده مشاوره‌های مربیگری',
    permissions: STAFF_ROLE_PERMISSIONS.trainer,
  },
  {
    key: 'designer',
    nameFa: 'گرافیست',
    description: 'آپلود رسانه، هیرو و تصاویر مجله',
    permissions: STAFF_ROLE_PERMISSIONS.designer,
  },
  {
    key: 'social',
    nameFa: 'سوشال',
    description: 'اعلان‌ها و محتوای شبکه‌های اجتماعی / مجله',
    permissions: STAFF_ROLE_PERMISSIONS.social,
  },
  {
    key: 'shop_procurement',
    nameFa: 'مدیر تامین فروشگاه',
    description: 'محصولات، قیمت و موجودی فروشگاه',
    permissions: STAFF_ROLE_PERMISSIONS.shop_procurement,
  },
  {
    key: 'content_editor',
    nameFa: 'تولید محتوا',
    description: 'ویرایش و انتشار مجله و اعلان‌ها',
    permissions: STAFF_ROLE_PERMISSIONS.content_editor,
  },
];

export type StaffAgentDef = {
  username: string;
  orgEmail: string;
  roleKey: StaffRoleKey;
  displayName: string;
  firstName: string;
  lastName: string;
  personnelCode: string;
  jobTitle: string;
  department: string;
  /** TEAM_AGENTS slug when this login is a public chat persona */
  teamAgentSlug?: string;
  avatarUrl?: string;
};

/**
 * One panel account per Grok/ops agent.
 * Five named rows stay 1:1 with TEAM_AGENTS; four ops-only rows have no landing card.
 */
export const STAFF_AGENTS: readonly StaffAgentDef[] = [
  {
    username: 'sanaz',
    orgEmail: 'sanaz@petdate.ir',
    roleKey: 'veterinarian',
    displayName: 'دکتر ساناز غفاری',
    firstName: 'ساناز',
    lastName: 'غفاری',
    personnelCode: 'STAFF-SANAZ',
    jobTitle: 'دامپزشک',
    department: 'بالینی',
    teamAgentSlug: 'sanaz-ghaffari',
    avatarUrl: '/agents/sanaz-ghaffari.jpg',
  },
  {
    username: 'sara',
    orgEmail: 'sara@petdate.ir',
    roleKey: 'veterinarian',
    displayName: 'دکتر سارا نوری',
    firstName: 'سارا',
    lastName: 'نوری',
    personnelCode: 'STAFF-SARA',
    jobTitle: 'دامپزشک',
    department: 'بالینی',
    teamAgentSlug: 'sara-noori',
    avatarUrl: '/agents/sara-noori.jpg',
  },
  {
    username: 'yalda',
    orgEmail: 'yalda@petdate.ir',
    roleKey: 'support',
    displayName: 'یلدا شعبانی',
    firstName: 'یلدا',
    lastName: 'شعبانی',
    personnelCode: 'STAFF-YALDA',
    jobTitle: 'پشتیبانی',
    department: 'پشتیبانی',
    teamAgentSlug: 'yalda-shabani',
    avatarUrl: '/agents/yalda-shabani.jpg',
  },
  {
    username: 'faranak',
    orgEmail: 'faranak@petdate.ir',
    roleKey: 'trainer',
    displayName: 'فرانک احمدی',
    firstName: 'فرانک',
    lastName: 'احمدی',
    personnelCode: 'STAFF-FARANAK',
    jobTitle: 'مربی',
    department: 'تربیت',
    teamAgentSlug: 'faranak-ahmadi',
    avatarUrl: '/agents/faranak-ahmadi.jpg',
  },
  {
    username: 'leila',
    orgEmail: 'leila@petdate.ir',
    roleKey: 'trainer',
    displayName: 'لیلا کیانی',
    firstName: 'لیلا',
    lastName: 'کیانی',
    personnelCode: 'STAFF-LEILA',
    jobTitle: 'مربی',
    department: 'تربیت',
    teamAgentSlug: 'leila-kiani',
    avatarUrl: '/agents/leila-kiani.jpg',
  },
  {
    username: 'staff.designer',
    orgEmail: 'staff.designer@petdate.ir',
    roleKey: 'designer',
    displayName: 'گرافیست',
    firstName: 'گرافیست',
    lastName: 'پت‌دیت',
    personnelCode: 'STAFF-DESIGNER',
    jobTitle: 'گرافیست',
    department: 'رسانه',
  },
  {
    username: 'staff.social',
    orgEmail: 'staff.social@petdate.ir',
    roleKey: 'social',
    displayName: 'سوشال',
    firstName: 'سوشال',
    lastName: 'پت‌دیت',
    personnelCode: 'STAFF-SOCIAL',
    jobTitle: 'سوشال',
    department: 'بازاریابی',
  },
  {
    username: 'staff.shop',
    orgEmail: 'staff.shop@petdate.ir',
    roleKey: 'shop_procurement',
    displayName: 'مدیر تامین فروشگاه',
    firstName: 'تامین',
    lastName: 'فروشگاه',
    personnelCode: 'STAFF-SHOP',
    jobTitle: 'مدیر تامین فروشگاه',
    department: 'فروشگاه',
  },
  {
    username: 'staff.content',
    orgEmail: 'staff.content@petdate.ir',
    roleKey: 'content_editor',
    displayName: 'تولید محتوا',
    firstName: 'تولید',
    lastName: 'محتوا',
    personnelCode: 'STAFF-CONTENT',
    jobTitle: 'تولید محتوا',
    department: 'محتوا',
  },
];

export function staffAgentsForTeamSlug(slug: string): StaffAgentDef | undefined {
  return STAFF_AGENTS.find((a) => a.teamAgentSlug === slug);
}

/** ADMIN_STAFF_PASSWORD → ADMIN_SEED_PASSWORD → dev placeholder. Production with neither → null. */
export function resolveStaffSeedPassword(
  env: { ADMIN_STAFF_PASSWORD?: string; ADMIN_SEED_PASSWORD?: string; NODE_ENV?: string } = process.env
): string | null {
  const staff = String(env.ADMIN_STAFF_PASSWORD || '').trim();
  if (staff) return staff;
  const seed = String(env.ADMIN_SEED_PASSWORD || '').trim();
  if (seed) return seed;
  if (String(env.NODE_ENV || '').trim() !== 'production') return DEFAULT_DEV_STAFF_PASSWORD;
  return null;
}

/** Public chat personas that must keep TEAM_AGENTS telegram ids / slugs. */
export function linkedPublicStaffAgents(): StaffAgentDef[] {
  return STAFF_AGENTS.filter((a) => a.teamAgentSlug);
}

export function assertStaffAgentsLinkedToTeamChat(): void {
  const publicStaff = linkedPublicStaffAgents();
  if (publicStaff.length !== TEAM_AGENTS.length) {
    throw new Error('staff roster public faces must match TEAM_AGENTS count');
  }
  for (const agent of TEAM_AGENTS) {
    const staff = staffAgentsForTeamSlug(agent.slug);
    if (!staff) throw new Error(`missing staff login for team agent ${agent.slug}`);
    if (staff.displayName !== agent.name) {
      throw new Error(`staff displayName must stay ${agent.name} for ${agent.slug}`);
    }
  }
}
