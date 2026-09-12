import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Home,
  LayoutDashboard,
  MessagesSquare,
  HeartHandshake,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  UserRound,
  LifeBuoy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { primaryRole, type UserRole } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { LandingChrome } from './LandingChrome';
import { LiveIncomingRequests } from './LiveIncomingRequests';
import { ProfileManageNav } from './ProfileManageNav';
import { RoleSwitchControl } from './RoleSwitchControl';

type NavDef = { to: string; icon: LucideIcon; labelKey: string };

/** Bot-parity destinations — nav follows active/primary role (like bot reply menus). */
const OWNER_NAV: NavDef[] = [
  { to: '/', icon: Home, labelKey: 'common.home' },
  { to: '/home', icon: LayoutDashboard, labelKey: 'nav.panel' },
  { to: '/chats', icon: HeartHandshake, labelKey: 'nav.playmate' },
  { to: '/my-pets', icon: PawPrint, labelKey: 'nav.my_pets' },
  { to: '/vet-consult', icon: Stethoscope, labelKey: 'nav.quickConsult' },
  { to: '/trainer-consult', icon: GraduationCap, labelKey: 'nav.findTrainer' },
  { to: '/shop', icon: ShoppingBag, labelKey: 'nav.petShop' },
  { to: '/support', icon: LifeBuoy, labelKey: 'nav.support' },
];

const VET_NAV: NavDef[] = [
  { to: '/', icon: Home, labelKey: 'common.home' },
  { to: '/vet-consult', icon: Stethoscope, labelKey: 'nav.vet_panel' },
  { to: '/chats', icon: MessagesSquare, labelKey: 'nav.conversations' },
  { to: '/profile', icon: UserRound, labelKey: 'nav.profile' },
  { to: '/support', icon: LifeBuoy, labelKey: 'nav.support' },
  { to: '/shop', icon: ShoppingBag, labelKey: 'nav.petShop' },
];

const TRAINER_NAV: NavDef[] = [
  { to: '/', icon: Home, labelKey: 'common.home' },
  { to: '/trainer-consult', icon: GraduationCap, labelKey: 'nav.trainer_panel' },
  { to: '/chats', icon: MessagesSquare, labelKey: 'nav.conversations' },
  { to: '/profile', icon: UserRound, labelKey: 'nav.profile' },
  { to: '/support', icon: LifeBuoy, labelKey: 'nav.support' },
  { to: '/shop', icon: ShoppingBag, labelKey: 'nav.petShop' },
];

const DEFAULT_NAV: NavDef[] = [
  { to: '/', icon: Home, labelKey: 'common.home' },
  { to: '/support', icon: LifeBuoy, labelKey: 'nav.support' },
  { to: '/home', icon: LayoutDashboard, labelKey: 'nav.panel' },
  { to: '/chats', icon: MessagesSquare, labelKey: 'nav.conversations' },
  { to: '/profile', icon: UserRound, labelKey: 'nav.profile' },
  { to: '/shop', icon: ShoppingBag, labelKey: 'nav.petShop' },
];

function navForRole(role?: UserRole): NavDef[] {
  if (role === 'vet') return VET_NAV;
  if (role === 'trainer') return TRAINER_NAV;
  if (role === 'pet_owner') return OWNER_NAV;
  return DEFAULT_NAV;
}

export function Layout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const active = primaryRole(user?.roles, user?.role);
  const navItems = navForRole(active);
  const isChat =
    pathname === '/chats' ||
    pathname.startsWith('/chats/') ||
    pathname.startsWith('/vet-chats/');
  return (
    <LandingChrome
      appNav
      hideBanner
      footer={!isChat}
      className={`pepito-app-shell${isChat ? ' pepito-app-shell--chat' : ''}`}
    >
      <div className="pepito-app-layout">
        <aside className="pepito-app-rail" aria-label={t('nav.mainMenu')}>
          <nav className="pepito-app-rail-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/' || item.to === '/home'}
                className={({ isActive }) => `pepito-app-rail-link${isActive ? ' is-active' : ''}`}
              >
                <item.icon size={18} strokeWidth={2} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
            <ProfileManageNav variant="rail" />
            <RoleSwitchControl variant="rail" />
          </nav>
        </aside>

        <main className="pepito-app-main">
          {children ?? <Outlet />}
          <LiveIncomingRequests />
        </main>
      </div>
    </LandingChrome>
  );
}
