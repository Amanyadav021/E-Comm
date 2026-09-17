'use client';

import { useState } from 'react';
import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/providers';
import { Button, Input } from '@/components/ui';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/me/profile', { name: name || undefined, email: email || undefined });
      setUser({ ...user, name: name || user.name, email: email || user.email });
      toast('success', 'Profile updated');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Could not update profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">Profile</h1>
      <form onSubmit={save} className="max-w-md space-y-4 rounded-card border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1.5 flex items-center gap-1 text-xs">
            {user.emailVerified ? (
              <span className="flex items-center gap-1 text-emerald-600"><BadgeCheck className="size-3.5" /> Verified</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600"><ShieldAlert className="size-3.5" /> Not verified</span>
            )}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Phone</label>
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
            {user.phone ? `+91 ${user.phone}` : 'Not added — sign in once with OTP to link a phone'}
          </p>
        </div>
        <Button type="submit" loading={busy}>Save changes</Button>
      </form>
    </div>
  );
}
