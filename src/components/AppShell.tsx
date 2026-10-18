import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  MessageSquare,
  Bot,
  Cpu,
  Blocks,
  Github,
  Rocket,
  Settings,
  LogOut,
  Bell,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/auth/AuthContext';
import { useState } from 'react';
import { NotificationsMenu } from '@/components/NotificationsMenu';

interface NavItem {
  to: string;
  key: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/projects', key: 'nav.projects', icon: FolderGit2 },
  { to: '/chat', key: 'nav.chat', icon: MessageSquare },
  { to: '/agents', key: 'nav.agentStudio', icon: Bot },
  { to: '/models', key: 'nav.models', icon: Cpu },
  { to: '/skills', key: 'nav.skills', icon: Blocks },
  { to: '/github', key: 'github.title', icon: Github },
  { to: '/deployments', key: 'nav.deployments', icon: Rocket },
];

export function AppShell() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/signin');
  }

  const initials = (user?.user_metadata?.full_name as string | undefined)?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur-md">
        <div className="flex items-center h-16 px-4 lg:px-6 gap-4">
          <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
            <Logo size={30} withWordmark />
          </NavLink>

          <nav className="hidden md:flex items-center gap-0.5 mx-2 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ink-800 text-ink-100'
                      : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/60'
                  }`
                }
              >
                <item.icon size={16} />
                <span className="whitespace-nowrap">{t(item.key)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1.5">
            <NotificationsMenu />
            <LanguageSwitcher />
            <NavLink to="/settings" className="btn-ghost h-9 w-9 p-0 justify-center" title={t('nav.settings')}>
              <Settings size={16} />
            </NavLink>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="h-9 w-9 rounded-full bg-ink-800 hover:bg-ink-700 text-ink-200 font-medium text-sm flex items-center justify-center transition-colors"
                aria-label={t('nav.profile')}
              >
                {initials}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute end-0 mt-2 w-56 surface-raised shadow-card py-1 z-50 animate-fade-in">
                    <div className="px-3 py-2 border-b border-ink-800">
                      <p className="text-sm text-ink-100 truncate font-medium">
                        {(user?.user_metadata?.full_name as string) ?? t('nav.profile')}
                      </p>
                      <p className="text-xs text-ink-500 truncate">{user?.email}</p>
                    </div>
                    <NavLink
                      to="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink-200 hover:bg-ink-800"
                    >
                      <Settings size={14} /> {t('nav.settings')}
                    </NavLink>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-400 hover:bg-ink-800"
                    >
                      <LogOut size={14} /> {t('nav.signOut')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-100'
                }`
              }
            >
              <item.icon size={14} />
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 lg:px-6 py-6 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
