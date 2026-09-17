'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, CheckCircle2, ChevronLeft, CreditCard, Landmark, Loader2, MapPin,
  Plus, ShieldCheck, Smartphone, Wallet, XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/components/providers';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { AddressForm } from '@/components/account/address-form';
import { PriceSummary } from '@/components/cart/price-summary';
import type { Address } from '@/lib/types';

type PayMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';

interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  amount: number;
  checkout: {
    provider: string;
    providerOrderId: string;
    amountPaise: number;
    currency: string;
    keyId?: string;
  } | null;
}

const METHODS: Array<{ value: PayMethod; label: string; note: string; icon: typeof Smartphone }> = [
  { value: 'upi', label: 'UPI', note: 'GPay, PhonePe, Paytm & more', icon: Smartphone },
  { value: 'card', label: 'Credit / Debit Card', note: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { value: 'netbanking', label: 'Net Banking', note: 'All major banks', icon: Landmark },
  { value: 'wallet', label: 'Wallets', note: 'Paytm, Amazon Pay & more', icon: Wallet },
  { value: 'cod', label: 'Cash on Delivery', note: 'Pay when it arrives', icon: Banknote },
];

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/** Dev gateway checkout — mirrors a hosted gateway page, then the REAL verify handshake runs. */
function MockPayModal({
  order,
  onDone,
}: {
  order: CheckoutResponse;
  onDone: (result: 'success' | 'failure') => void;
}) {
  const [busy, setBusy] = useState<'success' | 'failure' | null>(null);
  const toast = useToast();

  const simulate = async (outcome: 'success' | 'failure') => {
    setBusy(outcome);
    try {
      const sim = await api.post<{
        outcome: string;
        providerOrderId?: string;
        providerPaymentId?: string;
        signature?: string;
      }>('/payments/mock/simulate', { orderId: order.orderId, outcome });
      if (sim.outcome === 'success') {
        await api.post('/payments/verify', {
          orderId: order.orderId,
          providerOrderId: sim.providerOrderId,
          providerPaymentId: sim.providerPaymentId,
          signature: sim.signature,
        });
        onDone('success');
      } else {
        onDone('failure');
      }
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Payment could not be completed');
      onDone('failure');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">M</span>
          <div>
            <p className="font-bold">MockPay Checkout</p>
            <p className="text-xs text-zinc-400">Development gateway — no real money moves</p>
          </div>
        </div>
        <div className="rounded-xl bg-zinc-50 p-4 text-center dark:bg-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Paying ShopCraft</p>
          <p className="mt-1 text-3xl font-extrabold">{formatINR(order.amount, true)}</p>
          <p className="mt-1 text-xs text-zinc-400">Order {order.orderNumber}</p>
        </div>
        <div className="mt-5 space-y-2">
          <Button className="w-full" size="lg" loading={busy === 'success'} disabled={!!busy} onClick={() => simulate('success')}>
            <CheckCircle2 className="size-5" /> Simulate successful payment
          </Button>
          <Button variant="outline" className="w-full" loading={busy === 'failure'} disabled={!!busy} onClick={() => simulate('failure')}>
            <XCircle className="size-5" /> Simulate failed payment
          </Button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-400">
          The success path returns a signed payload which the server verifies with an HMAC signature —
          the exact Razorpay handshake.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const { cart, isLoading: cartLoading } = useCart();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [method, setMethod] = useState<PayMethod>('upi');
  const [placing, setPlacing] = useState(false);
  const [gatewayOrder, setGatewayOrder] = useState<CheckoutResponse | null>(null);
  const [failedOrder, setFailedOrder] = useState<CheckoutResponse | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const { data: addresses, isLoading: addrLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<Address[]>('/me/addresses'),
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/checkout');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (addresses && !addressId) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (def) setAddressId(def.id);
      else setAddingAddress(true);
    }
  }, [addresses, addressId]);

  if (authLoading || !user || cartLoading || addrLoading) return <Spinner />;

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title="Nothing to check out"
        text="Your cart is empty. Add something first!"
        action={{ label: 'Browse products', href: '/products' }}
      />
    );
  }

  const codBlocked = cart.items.some((i) => !i.codAvailable);

  const onPaymentDone = (result: 'success' | 'failure', order: CheckoutResponse) => {
    setGatewayOrder(null);
    if (result === 'success') {
      qc.invalidateQueries({ queryKey: ['cart'] });
      router.push(`/order-confirmation/${order.orderId}`);
    } else {
      setFailedOrder(order);
    }
  };

  const openRazorpay = (order: CheckoutResponse) => {
    const co = order.checkout!;
    const rzp = new window.Razorpay!({
      key: co.keyId,
      amount: co.amountPaise,
      currency: co.currency,
      name: 'ShopCraft',
      description: `Order ${order.orderNumber}`,
      order_id: co.providerOrderId,
      handler: async (response: any) => {
        try {
          await api.post('/payments/verify', {
            orderId: order.orderId,
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          onPaymentDone('success', order);
        } catch (err) {
          toast('error', err instanceof ApiError ? err.message : 'Payment verification failed');
          onPaymentDone('failure', order);
        }
      },
      modal: { ondismiss: () => onPaymentDone('failure', order) },
      theme: { color: '#4f46e5' },
    });
    rzp.open();
  };

  const startPayment = (order: CheckoutResponse) => {
    if (!order.checkout) {
      // COD — confirmed immediately
      qc.invalidateQueries({ queryKey: ['cart'] });
      router.push(`/order-confirmation/${order.orderId}`);
      return;
    }
    if (order.checkout.provider === 'razorpay') {
      if (window.Razorpay) openRazorpay(order);
      else {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => openRazorpay(order);
        script.onerror = () => toast('error', 'Could not load the payment gateway. Check your connection and retry.');
        document.body.appendChild(script);
      }
    } else {
      setGatewayOrder(order);
    }
  };

  const placeOrder = async () => {
    if (!addressId) {
      toast('error', 'Please select a delivery address');
      return;
    }
    setPlacing(true);
    setFailedOrder(null);
    try {
      const order = await api.post<CheckoutResponse>('/orders/checkout', {
        addressId,
        paymentMethod: method,
        idempotencyKey,
      });
      startPayment(order);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Could not place the order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const retryPayment = async () => {
    if (!failedOrder) return;
    setPlacing(true);
    try {
      const retry = await api.post<{ orderId: string; orderNumber: string; checkout: CheckoutResponse['checkout'] }>(
        `/payments/retry/${failedOrder.orderId}`,
      );
      startPayment({ ...failedOrder, checkout: retry.checkout });
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Retry failed');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/cart" aria-label="Back to cart" className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">Checkout</h1>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
          <ShieldCheck className="size-4 text-emerald-500" /> Secure checkout
        </span>
      </div>

      {failedOrder && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-900/20">
          <XCircle className="size-6 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-rose-700 dark:text-rose-300">Payment failed for order {failedOrder.orderNumber}</p>
            <p className="text-sm text-rose-600/80 dark:text-rose-300/80">
              No money is charged for failed attempts. Your order is reserved — retry within 45 minutes.
            </p>
          </div>
          <Button onClick={retryPayment} loading={placing}>Retry payment</Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Step 1: Address */}
          <section className="rounded-card border border-zinc-200/80 bg-white p-4 md:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <MapPin className="size-5 text-brand-600" /> Delivery address
            </h2>
            <div className="space-y-2.5">
              {(addresses ?? []).map((a) => (
                <label
                  key={a.id}
                  className={clsx(
                    'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition',
                    addressId === a.id
                      ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100 dark:bg-brand-900/20 dark:ring-brand-900'
                      : 'border-zinc-200 hover:border-brand-200 dark:border-zinc-700',
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    className="mt-1 accent-brand-600"
                  />
                  <div className="text-sm">
                    <p className="font-semibold">
                      {a.fullName}
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800">
                        {a.type}
                      </span>
                      {a.isDefault && <span className="ml-1.5 text-[10px] font-bold uppercase text-brand-600">Default</span>}
                    </p>
                    <p className="mt-0.5 text-zinc-500">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}
                      {a.area ? `, ${a.area}` : ''}, {a.city}, {a.state} — {a.pincode}
                    </p>
                    <p className="mt-0.5 text-zinc-400">Phone: {a.phone}</p>
                  </div>
                </label>
              ))}
              {addingAddress ? (
                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <AddressForm
                    onSaved={(a) => {
                      qc.invalidateQueries({ queryKey: ['addresses'] });
                      setAddressId(a.id);
                      setAddingAddress(false);
                    }}
                    onCancel={(addresses ?? []).length > 0 ? () => setAddingAddress(false) : undefined}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingAddress(true)}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm font-semibold text-brand-600 hover:border-brand-300 hover:bg-brand-50/50 dark:border-zinc-600 dark:hover:bg-brand-900/10"
                >
                  <Plus className="size-4" /> Add new address
                </button>
              )}
            </div>
          </section>

          {/* Step 2: Payment method */}
          <section className="rounded-card border border-zinc-200/80 bg-white p-4 md:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <CreditCard className="size-5 text-brand-600" /> Payment method
            </h2>
            <div className="space-y-2.5">
              {METHODS.map((m) => {
                const disabled = m.value === 'cod' && codBlocked;
                return (
                  <label
                    key={m.value}
                    className={clsx(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition',
                      disabled && 'cursor-not-allowed opacity-50',
                      method === m.value && !disabled
                        ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100 dark:bg-brand-900/20 dark:ring-brand-900'
                        : 'border-zinc-200 hover:border-brand-200 dark:border-zinc-700',
                    )}
                  >
                    <input
                      type="radio"
                      name="method"
                      disabled={disabled}
                      checked={method === m.value}
                      onChange={() => setMethod(m.value)}
                      className="accent-brand-600"
                    />
                    <m.icon className="size-5 text-zinc-500" />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold">{m.label}</p>
                      <p className="text-xs text-zinc-400">
                        {disabled ? 'Not available for an item in your cart' : m.note}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="space-y-4 rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-bold">Order summary</h2>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {cart.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="line-clamp-1 text-zinc-600 dark:text-zinc-300">
                    {i.name} <span className="text-zinc-400">× {i.qty}</span>
                  </span>
                  <span className="shrink-0 font-medium">{formatINR(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <PriceSummary summary={cart.summary} couponCode={cart.couponCode} />
            <Button size="lg" className="w-full" loading={placing} onClick={placeOrder} disabled={!addressId}>
              {method === 'cod' ? 'Place order' : `Pay ${formatINR(cart.summary.total, true)}`}
            </Button>
            <p className="text-center text-xs text-zinc-400">
              Prices are re-verified on our servers before payment.
            </p>
          </div>
        </div>
      </div>

      {gatewayOrder && (
        <MockPayModal order={gatewayOrder} onDone={(r) => onPaymentDone(r, gatewayOrder)} />
      )}
    </div>
  );
}
