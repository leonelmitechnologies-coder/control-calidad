/**
 * API Configuration
 * Central configuration for backend API endpoints
 */

declare const __API_URL__: string;

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  auth: {
    me: `${API_BASE_URL}/api/me`,
    logout: `${API_BASE_URL}/api/logout`,
    login: `${API_BASE_URL}/api/auth/login`,
    callback: `${API_BASE_URL}/api/auth/callback`,
  },
  dashboard: {
    summary: `${API_BASE_URL}/api/dashboard/summary`,
  },
} as const;
