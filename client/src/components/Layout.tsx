/**
 * Main Layout Component
 * Provides sidebar navigation, header, and main content area
 */

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { logout, redirectToLogin } from '../api/auth';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), href: '/', icon: '📊' },
    { label: t('nav.nc'), href: '/nc', icon: '⚠️' },
    { label: t('nav.recepciones'), href: '/recepciones', icon: '📦' },
    { label: t('nav.rechazos_ext'), href: '/rechazos-ext', icon: '❌' },
    { label: t('nav.rechazos_int'), href: '/rechazos-int', icon: '🔍' },
    { label: t('nav.capas'), href: '/capas', icon: '📋' },
    { label: t('nav.aql'), href: '/aql', icon: '📈' },
    { label: t('nav.liberacion_shipping'), href: '/liberacion-shipping', icon: '🚚' },
    { label: t('nav.organigrama'), href: '/organigrama-qc', icon: '🏢' },
    { label: t('nav.calendario'), href: '/calendario', icon: '📅' },
  ];

  const languages = [
    { code: 'es-MX', label: 'Español (MX)' },
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '中文' },
  ];

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      redirectToLogin();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    redirectToLogin();
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900">{t('app.title')}</h1>
          <p className="text-xs text-gray-500 mt-1">{t('app.subtitle')}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Language Selector */}
        <div className="border-t border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 mb-2">{t('layout.language')}</div>
          <div className="flex flex-col gap-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`text-left px-3 py-1.5 text-xs rounded ${
                  i18n.language === lang.code
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* User Section */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="h-10 w-10 rounded-full bg-gray-200"
              />
            )}
            {!user?.picture && (
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email || 'N/A'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
          >
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-6">
        <div className="bg-white rounded-lg shadow p-6">{children}</div>
      </main>
    </div>
  );
}
