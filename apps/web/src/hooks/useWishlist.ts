'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from './useAuth';
import { useToast } from '@/components/providers';
import type { ProductCard } from '@/lib/types';

export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api.get<ProductCard[]>('/wishlist'),
    enabled: !!user,
  });

  const ids = new Set((query.data ?? []).map((p) => p.id));

  const toggle = useMutation({
    mutationFn: async (productId: string) => {
      if (ids.has(productId)) {
        await api.delete(`/wishlist/${productId}`);
        return { productId, added: false };
      }
      await api.post('/wishlist', { productId });
      return { productId, added: true };
    },
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      toast(added ? 'success' : 'info', added ? 'Saved to wishlist' : 'Removed from wishlist');
    },
    onError: () => toast('error', 'Could not update wishlist'),
  });

  const moveToCart = useMutation({
    mutationFn: (productId: string) => api.post(`/wishlist/${productId}/move-to-cart`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      toast('success', 'Moved to cart');
    },
    onError: () => toast('error', 'Could not move to cart'),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    has: (productId: string) => ids.has(productId),
    count: query.data?.length ?? 0,
    toggle,
    moveToCart,
    isAuthed: !!user,
  };
}
