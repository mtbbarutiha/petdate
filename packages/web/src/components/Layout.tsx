import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  HandHelping,
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
import { LandingChrome } from './LandingChrome';
import { LiveIncomingRequests } from './LiveIncomingRequests';
import { RoleSwitchControl } from './RoleSwitchControl';

/** Bot-parity destinations — nav follows active/primary role (like bot reply menus). */
const OWNER_NAV: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/', icon: Home, label: 'خانه' },
  { to: '/home', icon: LayoutDashboard, label: 'پنل' },
  { to: '/chats', icon: HeartHandshake, label: 'هم بازی' },
  { to: '/my-pets', icon: PawPrint, label: 'پت‌های من' },
  { to: '/vet-consult', icon: Stethoscope, label: 'مشاوره سریع' },
  { to: '/trainer-consult', icon: GraduationCap, label: 'پیدا کردن مربی' },
  { to: '/sitter-consult', icon: HandHelping, label: 'پیدا کردن پرستار' },
  { to: '/shop', icon: ShoppingBag, label: 'پت‌شاپ' },
  { to: '/support', icon: LifeBuoy, label: 'پشتیبانی' },
];

const VET_NAV: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/', icon: Home, label: 'خانه' },
  { to: '/vet-consult', icon: Stethoscope, label: 'پنل پزشک' },
  { to: '/chats', icon: MessagesSquare, label: 'گفتگوها' },
  { to: '/profile', icon: UserRound, label: 'پروفایل' },
  { to: '/support', icon: LifeBuoy, label: 'پشتیبانی' },
  { to: '/shop', icon: ShoppingBag, label: 'پت‌شاپ' },
];

const TRAINER_NAV: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/', icon: Home, label: 'خانه' },
  { to: '/trainer-consult', icon: GraduationCap, label: 'پنل مربی' },
  { to: '/chats', icon: MessagesSquare, label: 'گفتگوها' },
  { to: '/profile', icon: UserRound, label: 'پروفایل' },
  { to: '/support', icon: LifeBuoy, label: 'پشتیبانی' },
  { to: '/shop', icon: ShoppingBag, label: 'پت‌شاپ' },
];

const SITTER_NAV: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/', icon: Home, label: 'خانه' },
  { to: '/sitter-consult', icon: HandHelping, label: 'پنل پرستار' },
  { to: '/chats', icon: MessagesSquare, label: 'گفتگوها' },
  { to: '/profile', icon: UserRound, label: 'پروفایل' },
  { to: '/support', icon: LifeBuoy, label: 'پشتیبانی' },
  { to: '/shop', icon: ShoppingBag, label: 'پت‌شاپ' },
];

const DEFAULT_NAV: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/', icon: Home, label: 'خانه' },
  { to: '/support', icon: LifeBuoy, label: 'پشتیبانی' },
  { to: '/home', icon: LayoutDashboard, label: 'پنل' },
  { to: '/chats', icon: MessagesSquare, label: 'گفتگوها' },
  { to: '/profile', icon: UserRound, label: 'پروفایل' },
  { to: '/shop', icon: ShoppingBag, label: 'پت‌شاپ' },
];

function navForRole(role?: UserRole): { to: string; icon: LucideIcon; label: string }[] {
  if (role === 'vet') return VET_NAV;
  if (role === 'trainer') return TRAINER_NAV;
  if (role === 'pet_sitter') return SITTER_NAV;
  if (role === 'pet_owner') return OWNER_NAV;
  return DEFAULT_NAV;
}

export function Layout() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
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
        <aside className="pepito-app-rail" aria-label="منوی بیشتر">
          <nav className="pepito-app-rail-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/' || item.to === '/home'}
                className={({ isActive }) => `pepito-app-rail-link${isActive ? ' is-active' : ''}`}
              >
                <item.icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <RoleSwitchControl variant="rail" />
          </nav>
        </aside>

        <main className="pepito-app-main">
          <Outlet />
          <LiveIncomingRequests />
        </main>
      </div>
    </LandingChrome>
  );
}
