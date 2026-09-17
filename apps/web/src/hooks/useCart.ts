'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useAuth } from './useAuth';
import { useToast } from '@/components/providers';
import type { CartData } from '@/lib/types';

export function useCart() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['cart'],
    queryFn: () => api.get<CartData>('/cart'),
    enabled: !!user,
  });

  const setCart = (cart: CartData) => qc.setQueryData(['cart'], cart);

  const onError = (err: unknown) => {
    toast('error', err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
  };

  const add = useMutation({
    mutationFn: (input: { variantId: string; qty?: number }) => api.post<CartData>('/cart/items', input),
    onSuccess: (cart) => {
      setCart(cart);
      toast('success', 'Added to cart');
    },
    onError,
  });

  const update = useMutation({
    mutationFn: (input: { itemId: string; qty: number }) =>
      api.patch<CartData>(`/cart/items/${input.itemId}`, { qty: input.qty }),
    onSuccess: setCart,
    onError,
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => api.delete<CartData>(`/cart/items/${itemId}`),
    onSuccess: (cart) => {
      setCart(cart);
      toast('info', 'Removed from cart');
    },
    onError,
  });

  const applyCoupon = useMutation({
    mutationFn: (code: string) => api.post<CartData>('/cart/coupon', { code }),
    onSuccess: (cart) => {
      setCart(cart);
      toast('success', 'Coupon applied');
    },
    onError,
  });

  const removeCoupon = useMutation({
    mutationFn: () => api.delete<CartData>('/cart/coupon'),
    onSuccess: setCart,
    onError,
  });

  return {
    cart: query.data ?? null,
    isLoading: query.isLoading,
    itemCount: query.data?.summary.itemCount ?? 0,
    add,
    update,
    remove,
    applyCoupon,
    removeCoupon,
    refetch: query.refetch,
  };
}
