'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, EmptyRow, Input, Modal, Select, Spinner, StatusBadge, Td, Th, Toggle } from '@/components/ui';

const EMPTY_COUPON = {
  code: '', description: '', type: 'PERCENT', value: '', minOrderAmount: '0', maxDiscount: '',
  startsAt: '', endsAt: '', usageLimit: '', perUserLimit: '1', firstOrderOnly: false, appliesTo: 'ALL', isActive: true,
};
const EMPTY_OFFER = {
  title: '', badgeText: '', type: 'PERCENT', value: '', maxDiscount: '', appliesTo: 'ALL',
  priority: '0', startsAt: '', endsAt: '', isFlashSale: false, isActive: true, categoryIds: [] as string[], productIds: [] as string[],
};

function dateInput(v: string | null | undefined): string {
  return v ? new Date(v).toISOString().slice(0, 10) : '';
}

export default function MarketingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'coupons' | 'offers'>('coupons');
  const [couponEdit, setCouponEdit] = useState<any | null>(null);
  const [offerEdit, setOfferEdit] = useState<any | null>(null);
  const [usageFor, setUsageFor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: coupons, isLoading: loadingCoupons } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => api.get<any[]>('/admin/marketing/coupons'),
  });
  const { data: offers, isLoading: loadingOffers } = useQuery({
    queryKey: ['admin-offers'],
    queryFn: () => api.get<any[]>('/admin/marketing/offers'),
  });
  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get<any[]>('/admin/catalog/categories'),
  });
  const { data: usage } = useQuery({
    queryKey: ['coupon-usage', usageFor?.id],
    queryFn: () => api.get<any[]>(`/admin/marketing/coupons/${usageFor.id}/usage`),
    enabled: !!usageFor,
  });

  const saveCoupon = async () => {
    setBusy(true);
    try {
      const c = couponEdit;
      const payload = {
        code: c.code, description: c.description || null, type: c.type, value: Number(c.value),
        minOrderAmount: Number(c.minOrderAmount) || 0,
        maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
        startsAt: c.startsAt || null, endsAt: c.endsAt || null,
        usageLimit: c.usageLimit ? Number(c.usageLimit) : null,
        perUserLimit: Number(c.perUserLimit) || 1,
        firstOrderOnly: c.firstOrderOnly, appliesTo: c.appliesTo, isActive: c.isActive,
      };
      if (c.id) await api.put(`/admin/marketing/coupons/${c.id}`, payload);
      else await api.post('/admin/marketing/coupons', payload);
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast('success', 'Coupon saved');
      setCouponEdit(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveOffer = async () => {
    setBusy(true);
    try {
      const o = offerEdit;
      const payload = {
        title: o.title, badgeText: o.badgeText || null, type: o.type, value: Number(o.value),
        maxDiscount: o.maxDiscount ? Number(o.maxDiscount) : null, appliesTo: o.appliesTo,
        priority: Number(o.priority) || 0, startsAt: o.startsAt || null, endsAt: o.endsAt || null,
        isFlashSale: o.isFlashSale, isActive: o.isActive,
        categoryIds: o.appliesTo === 'CATEGORY' ? o.categoryIds : undefined,
        productIds: o.appliesTo === 'PRODUCT' ? o.productIds : undefined,
      };
      if (o.id) await api.put(`/admin/marketing/offers/${o.id}`, payload);
      else await api.post('/admin/marketing/offers', payload);
      qc.invalidateQueries({ queryKey: ['admin-offers'] });
      toast('success', 'Offer saved');
      setOfferEdit(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeCoupon = async (c: any) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await api.delete(`/admin/marketing/coupons/${c.id}`);
    qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    toast('info', 'Coupon deleted');
  };
  const removeOffer = async (o: any) => {
    if (!confirm(`Delete offer "${o.title}"?`)) return;
    await api.delete(`/admin/marketing/offers/${o.id}`);
    qc.invalidateQueries({ queryKey: ['admin-offers'] });
    toast('info', 'Offer deleted');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Coupons &amp; Offers</h1>
        <div className="flex gap-2">
          <Link href="/marketing/abandoned-carts">
            <Button variant="outline" size="sm"><ShoppingCart className="size-4" /> Abandoned carts</Button>
          </Link>
          {tab === 'coupons' ? (
            <Button onClick={() => setCouponEdit({ ...EMPTY_COUPON })}><Plus className="size-4" /> New coupon</Button>
          ) : (
            <Button onClick={() => setOfferEdit({ ...EMPTY_OFFER })}><Plus className="size-4" /> New offer</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(['coupons', 'offers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition',
              tab === t ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'coupons' && (
        <Card>
          {loadingCoupons ? (
            <Spinner />
          ) : (
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <Th>Code</Th><Th>Discount</Th><Th>Min order</Th><Th>Usage</Th><Th>Validity</Th><Th>Status</Th><Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {coupons?.length === 0 && <EmptyRow span={7} text="No coupons yet. Create one to boost conversions." />}
                  {coupons?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <p className="font-mono font-bold">{c.code}</p>
                        <p className="max-w-52 truncate text-xs text-zinc-400">{c.description}</p>
                      </Td>
                      <Td className="font-semibold">
                        {c.type === 'PERCENT' ? `${c.value}%` : formatINR(c.value)}
                        {c.maxDiscount != null && <span className="ml-1 text-xs font-normal text-zinc-400">up to {formatINR(c.maxDiscount)}</span>}
                        {c.firstOrderOnly && <p className="text-[10px] font-bold uppercase text-brand-600">First order only</p>}
                      </Td>
                      <Td className="text-zinc-500">{formatINR(c.minOrderAmount)}</Td>
                      <Td>
                        <button onClick={() => setUsageFor(c)} className="text-brand-600 hover:underline">
                          {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''} used
                        </button>
                      </Td>
                      <Td className="text-xs text-zinc-400">
                        {c.endsAt ? `Until ${formatDate(c.endsAt)}` : 'No expiry'}
                      </Td>
                      <Td><StatusBadge status={c.isActive ? 'ACTIVE' : 'DISABLED'} /></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setCouponEdit({
                              ...c,
                              value: String(c.value), minOrderAmount: String(c.minOrderAmount),
                              maxDiscount: c.maxDiscount == null ? '' : String(c.maxDiscount),
                              usageLimit: c.usageLimit == null ? '' : String(c.usageLimit),
                              perUserLimit: String(c.perUserLimit),
                              startsAt: dateInput(c.startsAt), endsAt: dateInput(c.endsAt),
                              description: c.description ?? '',
                            })}
                            aria-label="Edit" className="rounded p-1.5 text-zinc-400 hover:text-brand-600"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button onClick={() => removeCoupon(c)} aria-label="Delete" className="rounded p-1.5 text-zinc-400 hover:text-rose-600">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'offers' && (
        <Card>
          {loadingOffers ? (
            <Spinner />
          ) : (
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <Th>Offer</Th><Th>Discount</Th><Th>Scope</Th><Th>Validity</Th><Th>Status</Th><Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {offers?.length === 0 && <EmptyRow span={6} text="No offers running." />}
                  {offers?.map((o: any) => (
                    <tr key={o.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <p className="font-semibold">{o.title}</p>
                        <p className="text-xs text-zinc-400">
                          {o.badgeText && <span className="mr-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/40">{o.badgeText}</span>}
                          {o.isFlashSale && <span className="text-[10px] font-bold uppercase text-amber-600">⚡ Flash sale</span>}
                        </p>
                      </Td>
                      <Td className="font-semibold">
                        {o.type === 'PERCENT' ? `${o.value}%` : formatINR(o.value)}
                        {o.maxDiscount != null && <span className="ml-1 text-xs font-normal text-zinc-400">up to {formatINR(o.maxDiscount)}</span>}
                      </Td>
                      <Td className="text-zinc-500">
                        {o.appliesTo === 'ALL' ? 'Entire store' : o.appliesTo === 'CATEGORY' ? `${o.categoryIds.length} categories` : `${o.productIds.length} products`}
                      </Td>
                      <Td className="text-xs text-zinc-400">{o.endsAt ? `Until ${formatDate(o.endsAt)}` : 'No expiry'}</Td>
                      <Td><StatusBadge status={o.isActive ? 'ACTIVE' : 'DISABLED'} /></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setOfferEdit({
                              ...o,
                              value: String(o.value), maxDiscount: o.maxDiscount == null ? '' : String(o.maxDiscount),
                              priority: String(o.priority), badgeText: o.badgeText ?? '',
                              startsAt: dateInput(o.startsAt), endsAt: dateInput(o.endsAt),
                            })}
                            aria-label="Edit" className="rounded p-1.5 text-zinc-400 hover:text-brand-600"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button onClick={() => removeOffer(o)} aria-label="Delete" className="rounded p-1.5 text-zinc-400 hover:text-rose-600">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Coupon editor */}
      {couponEdit && (
        <Modal title={couponEdit.id ? `Edit ${couponEdit.code}` : 'New coupon'} onClose={() => setCouponEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Code" value={couponEdit.code} onChange={(e) => setCouponEdit({ ...couponEdit, code: e.target.value.toUpperCase() })} disabled={!!couponEdit.id} />
            <Input label="Description" value={couponEdit.description} onChange={(e) => setCouponEdit({ ...couponEdit, description: e.target.value })} />
            <Select label="Type" value={couponEdit.type} onChange={(e) => setCouponEdit({ ...couponEdit, type: e.target.value })}>
              <option value="PERCENT">Percentage</option>
              <option value="FLAT">Flat amount</option>
            </Select>
            <Input label={couponEdit.type === 'PERCENT' ? 'Discount %' : 'Discount ₹'} type="number" value={couponEdit.value} onChange={(e) => setCouponEdit({ ...couponEdit, value: e.target.value })} />
            <Input label="Minimum order ₹" type="number" value={couponEdit.minOrderAmount} onChange={(e) => setCouponEdit({ ...couponEdit, minOrderAmount: e.target.value })} />
            <Input label="Max discount ₹ (optional)" type="number" value={couponEdit.maxDiscount} onChange={(e) => setCouponEdit({ ...couponEdit, maxDiscount: e.target.value })} />
            <Input label="Starts (optional)" type="date" value={couponEdit.startsAt} onChange={(e) => setCouponEdit({ ...couponEdit, startsAt: e.target.value })} />
            <Input label="Expires (optional)" type="date" value={couponEdit.endsAt} onChange={(e) => setCouponEdit({ ...couponEdit, endsAt: e.target.value })} />
            <Input label="Total usage limit (optional)" type="number" value={couponEdit.usageLimit} onChange={(e) => setCouponEdit({ ...couponEdit, usageLimit: e.target.value })} />
            <Input label="Per-customer limit" type="number" value={couponEdit.perUserLimit} onChange={(e) => setCouponEdit({ ...couponEdit, perUserLimit: e.target.value })} />
            <div className="space-y-3 sm:col-span-2">
              <Toggle label="First order only" checked={couponEdit.firstOrderOnly} onChange={(v) => setCouponEdit({ ...couponEdit, firstOrderOnly: v })} />
              <Toggle label="Active" checked={couponEdit.isActive} onChange={(v) => setCouponEdit({ ...couponEdit, isActive: v })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCouponEdit(null)}>Cancel</Button>
            <Button loading={busy} onClick={saveCoupon} disabled={!couponEdit.code || !couponEdit.value}>Save coupon</Button>
          </div>
        </Modal>
      )}

      {/* Offer editor */}
      {offerEdit && (
        <Modal title={offerEdit.id ? `Edit offer` : 'New offer'} onClose={() => setOfferEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Title" value={offerEdit.title} onChange={(e) => setOfferEdit({ ...offerEdit, title: e.target.value })} className="sm:col-span-2" />
            <Input label="Badge text (shown on products)" value={offerEdit.badgeText} onChange={(e) => setOfferEdit({ ...offerEdit, badgeText: e.target.value })} />
            <Input label="Priority (higher wins ties)" type="number" value={offerEdit.priority} onChange={(e) => setOfferEdit({ ...offerEdit, priority: e.target.value })} />
            <Select label="Type" value={offerEdit.type} onChange={(e) => setOfferEdit({ ...offerEdit, type: e.target.value })}>
              <option value="PERCENT">Percentage</option>
              <option value="FLAT">Flat amount</option>
            </Select>
            <Input label={offerEdit.type === 'PERCENT' ? 'Discount %' : 'Discount ₹'} type="number" value={offerEdit.value} onChange={(e) => setOfferEdit({ ...offerEdit, value: e.target.value })} />
            <Input label="Max discount ₹ (optional)" type="number" value={offerEdit.maxDiscount} onChange={(e) => setOfferEdit({ ...offerEdit, maxDiscount: e.target.value })} />
            <Select label="Applies to" value={offerEdit.appliesTo} onChange={(e) => setOfferEdit({ ...offerEdit, appliesTo: e.target.value })}>
              <option value="ALL">Entire store</option>
              <option value="CATEGORY">Selected categories</option>
            </Select>
            {offerEdit.appliesTo === 'CATEGORY' && (
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Categories</p>
                <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-700">
                  {(categories ?? []).map((c: any) => {
                    const selected = offerEdit.categoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setOfferEdit({
                          ...offerEdit,
                          categoryIds: selected ? offerEdit.categoryIds.filter((x: string) => x !== c.id) : [...offerEdit.categoryIds, c.id],
                        })}
                        className={clsx(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition',
                          selected ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                        )}
                      >
                        {c.parentId ? '· ' : ''}{c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Input label="Starts (optional)" type="date" value={offerEdit.startsAt} onChange={(e) => setOfferEdit({ ...offerEdit, startsAt: e.target.value })} />
            <Input label="Ends (optional)" type="date" value={offerEdit.endsAt} onChange={(e) => setOfferEdit({ ...offerEdit, endsAt: e.target.value })} />
            <div className="space-y-3 sm:col-span-2">
              <Toggle label="Flash sale styling" checked={offerEdit.isFlashSale} onChange={(v) => setOfferEdit({ ...offerEdit, isFlashSale: v })} />
              <Toggle label="Active" checked={offerEdit.isActive} onChange={(v) => setOfferEdit({ ...offerEdit, isActive: v })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOfferEdit(null)}>Cancel</Button>
            <Button loading={busy} onClick={saveOffer} disabled={!offerEdit.title || !offerEdit.value}>Save offer</Button>
          </div>
        </Modal>
      )}

      {/* Coupon usage */}
      {usageFor && (
        <Modal title={`Redemptions — ${usageFor.code}`} onClose={() => setUsageFor(null)} wide>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-zinc-400">
              <tr><th className="py-1.5">Customer</th><th>Order</th><th>Order total</th><th>Discount</th><th>Date</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {(usage ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-zinc-400">Not redeemed yet.</td></tr>
              )}
              {(usage ?? []).map((u: any, i: number) => (
                <tr key={i}>
                  <td className="py-2">{u.customer}</td>
                  <td>{u.orderNumber}</td>
                  <td>{formatINR(u.orderTotal, true)}</td>
                  <td className="text-emerald-600">− {formatINR(u.discount, true)}</td>
                  <td className="text-xs text-zinc-400">{formatDate(u.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
