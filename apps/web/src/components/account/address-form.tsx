'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import type { Address } from '@/lib/types';

const EMPTY = {
  fullName: '', phone: '', line1: '', line2: '', area: '', city: '', state: '', pincode: '',
  type: 'HOME' as Address['type'], isDefault: false,
};

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Address;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial, line2: initial.line2 ?? '', area: initial.area ?? '' } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const payload = { ...form, line2: form.line2 || null, area: form.area || null, country: 'India' };
      const saved = initial
        ? await api.patch<Address>(`/me/addresses/${initial.id}`, payload)
        : await api.post<Address>('/me/addresses', payload);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.issues) {
        setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      } else {
        setErrors({ _: err instanceof ApiError ? err.message : 'Could not save the address' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Input label="Full name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} required />
      <Input label="Phone" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} error={errors.phone} required />
      <Input className="sm:col-span-2" label="Address (house no, building, street)" value={form.line1} onChange={set('line1')} error={errors.line1} required />
      <Input label="Apartment / landmark (optional)" value={form.line2} onChange={set('line2')} error={errors.line2} />
      <Input label="Area / locality (optional)" value={form.area} onChange={set('area')} error={errors.area} />
      <Input label="City" value={form.city} onChange={set('city')} error={errors.city} required />
      <Input label="State" value={form.state} onChange={set('state')} error={errors.state} required />
      <Input label="Pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))} error={errors.pincode} required />
      <div>
        <label className="mb-1.5 block text-sm font-medium">Address type</label>
        <div className="flex gap-2">
          {(['HOME', 'WORK', 'OTHER'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: t }))}
              className={
                form.type === t
                  ? 'rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-300'
              }
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="accent-brand-600" />
        Make this my default address
      </label>
      {errors._ && <p className="text-sm text-rose-600 sm:col-span-2">{errors._}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {initial ? 'Save changes' : 'Save address'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
