/**
 * Login Page
 * OIDC authentication callback handler
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleOIDCCallback } from '../api/auth';

export default function Login() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        setIsLoading(true);
        const user = await handleOIDCCallback();
        if (user) {
          // Redirect to dashboard on successful authentication
          window.location.href = '/';
        } else {
          // If no user, redirect to login
          setError('Authentication failed');
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Login error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    processCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-6">{t('app.title')}</h1>

          {isLoading && (
            <div className="space-y-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">{t('common.loading')}</p>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-700">{error}</p>
              </div>
              <p className="text-sm text-gray-500">Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
