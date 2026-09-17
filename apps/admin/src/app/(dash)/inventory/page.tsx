'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Download, History, PackagePlus } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, EmptyRow, Input, Modal, Pagination, SearchInput, Select, Spinner, StatusBadge, Td, Th } from '@/components/ui';

function InventoryInner() {
  const qc = useQueryClient();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(searchParams.get('filter') ?? 'all');
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<any | null>(null);
  const [historyFor, setHistoryFor] = useState<any | null>(null);
  const [qty, setQty] = useState('');
  const [type, setType] = useState<'RESTOCK' | 'ADJUSTMENT'>('RESTOCK');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '25', filter });
  if (q) params.set('q', q);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inventory', params.toString()],
    queryFn: () => api.get<any>(`/admin/inventory?${params}`),
    placeholderData: keepPreviousData,
  });

  const { data: history } = useQuery({
    queryKey: ['inventory-history', historyFor?.variantId],
    queryFn: () => api.get<any>(`/admin/inventory/history/${historyFor.variantId}`),
    enabled: !!historyFor,
  });

  const adjust = async () => {
    setBusy(true);
    try {
      const signedQty = type === 'ADJUSTMENT' ? Number(qty) : Math.abs(Number(qty));
      await api.post('/admin/inventory/adjust', {
        variantId: adjusting.variantId,
        qty: signedQty,
        type,
        reason: reason || undefined,
      });
      qc.invalidateQueries({ queryKey: ['admin-inventory'] });
      toast('success', 'Stock updated');
      setAdjusting(null);
      setQty('');
      setReason('');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Adjustment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Inventory</h1>
        <a href="/api/admin/inventory/export" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
          <Download className="size-4" /> Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search product or SKU…" />
        </div>
        {(['all', 'low', 'out'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={clsx(
              'rounded-lg px-3.5 py-2 text-sm font-semibold transition',
              filter === f ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700',
            )}
          >
            {f === 'all' ? 'All' : f === 'low' ? 'Low stock' : 'Out of stock'}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <Th>Product</Th>
                    <Th>SKU</Th>
                    <Th>On hand</Th>
                    <Th>Reserved</Th>
                    <Th>Available</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={7} text="No inventory rows match." />}
                  {data?.items.map((v: any) => (
                    <tr key={v.variantId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          {v.image ? <img src={v.image} alt="" className="size-9 rounded-lg object-cover" /> : <div className="size-9 rounded-lg bg-zinc-100 dark:bg-zinc-800" />}
                          <div>
                            <p className="max-w-52 truncate font-medium">{v.productName}</p>
                            {v.variantName && <p className="text-xs text-zinc-400">{v.variantName}</p>}
                          </div>
                        </div>
                      </Td>
                      <Td className="font-mono text-xs text-zinc-500">{v.sku}</Td>
                      <Td className="font-semibold">{v.stockOnHand}</Td>
                      <Td className="text-zinc-500">{v.stockReserved}</Td>
                      <Td className="font-semibold">{v.available}</Td>
                      <Td><StatusBadge status={v.status} labels={{ OK: 'In stock', LOW: 'Low', OUT: 'Out of stock' }} /></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setAdjusting(v); setType('RESTOCK'); }} title="Adjust stock" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600 dark:hover:bg-zinc-800">
                            <PackagePlus className="size-4" />
                          </button>
                          <button onClick={() => setHistoryFor(v)} title="Movement history" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600 dark:hover:bg-zinc-800">
                            <History className="size-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
          </>
        )}
      </Card>

      {adjusting && (
        <Modal title={`Adjust stock — ${adjusting.sku}`} onClose={() => setAdjusting(null)}>
          <p className="mb-3 text-sm text-zinc-500">
            {adjusting.productName} · currently <strong>{adjusting.stockOnHand}</strong> on hand
          </p>
          <div className="space-y-3">
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="RESTOCK">Restock (add units)</option>
              <option value="ADJUSTMENT">Adjustment (+/− correction)</option>
            </Select>
            <Input
              label={type === 'RESTOCK' ? 'Units to add' : 'Adjustment (use negative to remove)'}
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New shipment received, damaged units" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjusting(null)}>Cancel</Button>
            <Button loading={busy} onClick={adjust} disabled={!qty || Number(qty) === 0}>Apply</Button>
          </div>
        </Modal>
      )}

      {historyFor && (
        <Modal title={`Movements — ${historyFor.sku}`} onClose={() => setHistoryFor(null)} wide>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="text-left text-[11px] uppercase text-zinc-400">
                <tr><th className="py-1.5">When</th><th>Type</th><th>Qty</th><th>Available after</th><th>By</th><th>Reason</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 text-sm dark:divide-zinc-800/60">
                {(history?.items ?? []).map((t: any) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap py-2 text-xs text-zinc-400">{formatDateTime(t.at)}</td>
                    <td><StatusBadge status={t.type} /></td>
                    <td className={clsx('font-semibold', t.qty > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                      {t.qty > 0 ? `+${t.qty}` : t.qty}
                    </td>
                    <td>{t.balanceAfter}</td>
                    <td className="text-zinc-500">{t.by}</td>
                    <td className="max-w-40 truncate text-xs text-zinc-400">{t.reason ?? (t.orderId ? 'Order' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <InventoryInner />
    </Suspense>
  );
}
