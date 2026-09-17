'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/providers';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { AddressForm } from '@/components/account/address-form';
import type { Address } from '@/lib/types';

export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<Address[]>('/me/addresses'),
  });

  if (isLoading) return <Spinner />;

  const refresh = () => qc.invalidateQueries({ queryKey: ['addresses'] });

  const remove = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    await api.delete(`/me/addresses/${id}`);
    refresh();
    toast('info', 'Address deleted');
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">Saved addresses</h1>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add address
          </Button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-5 rounded-card border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 font-semibold">{editing === 'new' ? 'New address' : 'Edit address'}</h2>
          <AddressForm
            initial={editing === 'new' ? undefined : editing}
            onSaved={() => {
              refresh();
              setEditing(null);
              toast('success', 'Address saved');
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {!addresses || addresses.length === 0 ? (
        editing === null && (
          <EmptyState
            icon={<MapPin />}
            title="No addresses saved"
            text="Add a delivery address to speed through checkout."
          />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-card border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="font-semibold">
                {a.fullName}
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800">{a.type}</span>
                {a.isDefault && <span className="ml-1.5 text-[10px] font-bold uppercase text-brand-600">Default</span>}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}{a.area ? `, ${a.area}` : ''}, {a.city}, {a.state} — {a.pincode}
              </p>
              <p className="mt-1 text-sm text-zinc-400">Phone: {a.phone}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setEditing(a)} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button onClick={() => remove(a.id)} className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline">
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
