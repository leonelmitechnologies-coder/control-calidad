/**
 * Authentication API Functions
 * Handle logout and OIDC callback operations
 */

import { API_ENDPOINTS } from '../config/api';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Get current user session from API
 */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(API_ENDPOINTS.auth.me, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    const data = await response.json();
    return data.user ?? data ?? null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  try {
    const response = await fetch(API_ENDPOINTS.auth.logout, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.status}`);
    }

    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Error during logout:', error);
    // Force redirect to login even if logout fails
    window.location.href = '/login';
  }
}

/**
 * Handle OIDC callback (called from /login route)
 */
export async function handleOIDCCallback(): Promise<User | null> {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      throw new Error('Missing OAuth code or state');
    }

    const response = await fetch(API_ENDPOINTS.auth.callback, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      throw new Error(`Callback failed: ${response.status}`);
    }

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error handling OIDC callback:', error);
    return null;
  }
}

/**
 * Redirect to OIDC login provider
 */
export function redirectToLogin(): void {
  window.location.href = API_ENDPOINTS.auth.login;
}
