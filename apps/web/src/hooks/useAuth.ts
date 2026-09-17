'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

async function fetchMe(): Promise<User | null> {
  try {
    const data = await api.get<{ user: User }>('/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // try one silent refresh
      try {
        const refreshed = await api.post<{ user: User }>('/auth/refresh');
        return refreshed.user;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function useAuth() {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  const setUser = (u: User | null) => qc.setQueryData(['me'], u);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    qc.clear();
  };

  return { user: user ?? null, isLoading, setUser, logout };
}
