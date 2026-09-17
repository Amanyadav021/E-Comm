'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, EmptyRow, Input, Modal, Pagination, Select, Spinner, StatusBadge, Td, Th, Textarea } from '@/components/ui';

const NEXT_ACTIONS: Record<string, Array<{ status: string; label: string; danger?: boolean }>> = {
  REQUESTED: [
    { status: 'APPROVED', label: 'Approve' },
    { status: 'REJECTED', label: 'Reject', danger: true },
  ],
  APPROVED: [
    { status: 'RECEIVED', label: 'Mark received' },
    { status: 'REJECTED', label: 'Reject', danger: true },
  ],
  RECEIVED: [{ status: 'COMPLETED', label: 'Complete & refund' }],
  REFUND_PROCESSING: [{ status: 'COMPLETED', label: 'Mark completed' }],
};

export default function ReturnsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ rr: any; to: string } | null>(null);
  const [comment, setComment] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (status) params.set('status', status);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-returns', params.toString()],
    queryFn: () => api.get<any>(`/admin/orders/returns?${params}`),
    placeholderData: keepPreviousData,
  });

  const apply = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await api.patch(`/admin/orders/returns/${action.rr.id}`, {
        status: action.to,
        adminComment: comment || undefined,
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
      });
      qc.invalidateQueries({ queryKey: ['admin-returns'] });
      toast('success', 'Return updated');
      setAction(null);
      setComment('');
      setRefundAmount('');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Return requests</h1>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className="w-48">
          <option value="">All statuses</option>
          {['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUND_PROCESSING', 'COMPLETED', 'REJECTED'].map((s) => (
            <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
          ))}
        </Select>
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
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Items</Th>
                    <Th>Value</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                    <Th>Requested</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={8} text="No return requests." />}
                  {data?.items.map((r: any) => (
                    <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <Link href={`/orders/${r.orderId}`} className="font-semibold text-brand-600 hover:underline">
                          {r.orderNumber}
                        </Link>
                      </Td>
                      <Td>{r.customer}</Td>
                      <Td className="text-zinc-500">{r.itemCount}</Td>
                      <Td className="font-semibold">{formatINR(r.estimatedValue, true)}</Td>
                      <Td className="max-w-48 truncate text-zinc-500">{r.reason}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(r.createdAt)}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {(NEXT_ACTIONS[r.status] ?? []).map((a) => (
                            <Button
                              key={a.status}
                              size="sm"
                              variant={a.danger ? 'danger' : 'primary'}
                              onClick={() => {
                                setAction({ rr: r, to: a.status });
                                setRefundAmount(String(r.estimatedValue));
                              }}
                            >
                              {a.label}
                            </Button>
                          ))}
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

      {action && (
        <Modal title={`${action.to.replaceAll('_', ' ')} — ${action.rr.orderNumber}`} onClose={() => setAction(null)}>
          <div className="space-y-3">
            {['COMPLETED', 'REFUND_PROCESSING'].includes(action.to) && (
              <Input
                label="Refund amount (₹)"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                hint="Refunded to the customer's original payment method"
              />
            )}
            <Textarea
              label={action.to === 'REJECTED' ? 'Reason for rejection (shared with customer)' : 'Comment (optional)'}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant={action.to === 'REJECTED' ? 'danger' : 'primary'} loading={busy} onClick={apply}>
              Confirm
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
