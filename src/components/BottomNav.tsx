import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, BrainCircuit, BarChart2, User, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const { t } = useTranslation();
  
  const navItems = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/coach', icon: MessageSquare, label: t('nav.coach') },
    { to: '/games', icon: BrainCircuit, label: t('nav.games') },
    { to: '/analytics', icon: BarChart2, label: t('nav.analytics') },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-safe pt-2 px-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 rounded-t-3xl transition-colors duration-300">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            twMerge(
              'flex flex-col items-center justify-center w-16 h-14 transition-all duration-300 relative',
              isActive ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute -top-2 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full -z-10 transition-colors duration-300" />
              )}
              <Icon className={clsx('w-6 h-6 mb-1 transition-colors duration-300', isActive ? 'fill-orange-500 text-orange-500' : 'text-gray-400 dark:text-gray-500')} />
              <span className={clsx("text-[10px] font-medium transition-colors duration-300", isActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500')}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
