'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Phone, Mail, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/providers';
import { Button, Input, Spinner } from '@/components/ui';
import type { User } from '@/lib/types';

type Mode = 'email-login' | 'email-register' | 'phone' | 'phone-otp';

declare global {
  interface Window {
    google?: any;
  }
}

function GoogleButton({ onSuccess }: { onSuccess: (user: User) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [unavailable, setUnavailable] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setUnavailable(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            const data = await api.post<{ user: User }>('/auth/google', { idToken: response.credential });
            onSuccess(data.user);
          } catch (err) {
            toast('error', err instanceof ApiError ? err.message : 'Google sign-in failed');
          }
        },
      });
      if (ref.current) {
        window.google?.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      }
    };
    script.onerror = () => setUnavailable(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (unavailable) return null;
  return <div ref={ref} className="flex justify-center" />;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const { user, setUser, isLoading } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('email-login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', code: '' });
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  if (isLoading) return <Spinner />;

  const done = (u: User) => {
    setUser(u);
    toast('success', `Welcome${u.name ? `, ${u.name.split(' ')[0]}` : ''}!`);
    router.replace(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'email-login') {
        const data = await api.post<{ user: User }>('/auth/login', { email: form.email, password: form.password });
        done(data.user);
      } else if (mode === 'email-register') {
        const data = await api.post<{ user: User }>('/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password,
        });
        done(data.user);
      } else if (mode === 'phone') {
        const res = await api.post<{ sent: boolean; devCode?: string }>('/auth/otp/request', { phone: form.phone });
        setDevCode(res.devCode ?? null);
        setMode('phone-otp');
      } else if (mode === 'phone-otp') {
        const data = await api.post<{ user: User }>('/auth/otp/verify', {
          phone: form.phone,
          code: form.code,
          name: form.name || undefined,
        });
        done(data.user);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">
        {mode === 'email-register' ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-1 text-center text-sm text-zinc-500">
        {mode === 'email-register' ? 'Join ShopCraft in seconds' : 'Sign in to continue shopping'}
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {mode === 'phone-otp' ? (
          <form onSubmit={submit} className="space-y-4">
            <button type="button" onClick={() => setMode('phone')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-brand-600">
              <ArrowLeft className="size-4" /> Change number
            </button>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Enter the 6-digit code sent to <strong>+91 {form.phone}</strong>
            </p>
            {devCode && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                Dev mode: your OTP is <strong>{devCode}</strong>
              </p>
            )}
            <Input
              label="OTP"
              inputMode="numeric"
              maxLength={6}
              value={form.code}
              onChange={set('code')}
              placeholder="6-digit code"
              autoFocus
            />
            <Input label="Your name (for new accounts)" value={form.name} onChange={set('name')} placeholder="Full name" />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              Verify &amp; continue
            </Button>
          </form>
        ) : mode === 'phone' ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Mobile number</label>
              <div className="flex items-center rounded-xl border border-zinc-200 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900">
                <span className="border-r border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-700">+91</span>
                <input
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="10-digit mobile number"
                  className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={busy} disabled={form.phone.length !== 10}>
              Send OTP
            </Button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'email-register' && (
              <Input label="Full name" value={form.name} onChange={set('name')} placeholder="Your name" required />
            )}
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder={mode === 'email-register' ? 'Min 8 chars, letters + numbers' : 'Your password'}
              required
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              {mode === 'email-register' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        )}

        {mode !== 'phone-otp' && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /> OR <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="space-y-3">
              <GoogleButton onSuccess={done} />
              {mode === 'phone' ? (
                <button
                  onClick={() => setMode('email-login')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <Mail className="size-4" /> Continue with Email
                </button>
              ) : (
                <button
                  onClick={() => setMode('phone')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <Phone className="size-4" /> Continue with Phone (OTP)
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {mode === 'email-login' && (
        <p className="mt-5 text-center text-sm text-zinc-500">
          New to ShopCraft?{' '}
          <button onClick={() => setMode('email-register')} className="font-semibold text-brand-600 hover:underline">
            Create an account
          </button>
        </p>
      )}
      {mode === 'email-register' && (
        <p className="mt-5 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <button onClick={() => setMode('email-login')} className="font-semibold text-brand-600 hover:underline">
            Sign in
          </button>
        </p>
      )}
      <p className="mt-6 text-center text-xs text-zinc-400">
        Demo account: demo@shopcraft.local / Demo@12345
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginInner />
    </Suspense>
  );
}
