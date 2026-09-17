'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  roles: string[];
}

async function fetchMe(): Promise<AdminUser | null> {
  try {
    const data = await api.get<{ user: AdminUser }>('/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      try {
        const refreshed = await api.post<{ user: AdminUser }>('/auth/refresh');
        return refreshed.user;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function useAdmin() {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery({ queryKey: ['admin-me'], queryFn: fetchMe, staleTime: 5 * 60_000 });

  const isStaff = !!user && user.roles.some((r) => r !== 'CUSTOMER');

  const logout = async () => {
    await api.post('/auth/logout');
    qc.clear();
  };

  return { user: user ?? null, isStaff, isLoading, logout, setUser: (u: AdminUser | null) => qc.setQueryData(['admin-me'], u) };
}
