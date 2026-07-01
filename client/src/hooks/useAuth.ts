/**
 * useAuth Hook
 * Custom hook for authentication state management with TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { User, fetchCurrentUser, logout } from '../api/auth';

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
  logout: () => void;
  isAuthenticated: boolean;
}

/**
 * useAuth hook
 * Fetches and manages the current user session
 */
export function useAuth(): UseAuthReturn {
  const {
    data: user = null,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  return {
    user,
    loading,
    error: error instanceof Error ? error : null,
    logout,
    isAuthenticated: !!user,
  };
}
