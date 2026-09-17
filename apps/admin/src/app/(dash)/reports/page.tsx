'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { Card, Select, Spinner, Td, Th } from '@/components/ui';

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 3 months' },
  { value: '180d', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
];

export default function ReportsPage() {
  const [range, setRange] = useState('30d');

  const { data: charts, isLoading } = useQuery({
    queryKey: ['report-charts', range],
    queryFn: () => api.get<any>(`/admin/reports/charts?range=${range}`),
  });
  const { data: methods } = useQuery({
    queryKey: ['report-methods', range],
    queryFn: () => api.get<any[]>(`/admin/reports/payment-methods?range=${range}`),
  });
  const { data: products } = useQuery({
    queryKey: ['report-products', range],
    queryFn: () => api.get<any>(`/admin/reports/products?range=${range}`),
  });
  const { data: customers } = useQuery({
    queryKey: ['report-customers', range],
    queryFn: () => api.get<any>(`/admin/reports/customers?range=${range}`),
  });

  if (isLoading) return <Spinner />;

  const revenueData = (charts?.revenueByDay ?? []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenue: r.revenue,
    orders: r.orders,
  }));
  const customerData = (charts?.newCustomersByDay ?? []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    customers: r.customers,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Reports</h1>
        <div className="flex flex-wrap gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range" className="w-40">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
          {[
            ['Orders', '/api/admin/orders/export'],
            ['Customers', '/api/admin/customers/export'],
            ['Inventory', '/api/admin/inventory/export'],
            ['Payments', '/api/admin/payments/export'],
          ].map(([label, href]) => (
            <a key={label} href={href} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
              <Download className="size-3.5" /> {label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue & orders">
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v: number, name) => (name === 'revenue' ? formatINR(v) : v)} />
                <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="New customers">
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerData} margin={{ top: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="customers" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400 dark:border-zinc-800">
            {customers?.purchasingCustomers ?? 0} customers purchased in this period · {customers?.repeatCustomers ?? 0} bought more than once
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Payment method performance">
          <div className="table-scroll">
            <table>
              <thead className="border-b border-zinc-100 dark:border-zinc-800">
                <tr><Th>Method</Th><Th>Attempts</Th><Th>Successful</Th><Th>Failed</Th><Th>Refunds</Th><Th>Value</Th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                {(methods ?? []).map((m: any) => (
                  <tr key={m.method}>
                    <Td className="font-semibold uppercase">{m.method}</Td>
                    <Td>{m.orders}</Td>
                    <Td className="text-emerald-600">{m.success}</Td>
                    <Td className="text-rose-600">{m.failed}</Td>
                    <Td>{m.refunded}</Td>
                    <Td className="font-semibold">{formatINR(m.value)}</Td>
                  </tr>
                ))}
                {(methods ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-zinc-400">No payment data in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Top spenders">
          <div className="table-scroll">
            <table>
              <thead className="border-b border-zinc-100 dark:border-zinc-800">
                <tr><Th>Customer</Th><Th>Orders</Th><Th>Spent</Th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                {(customers?.topSpenders ?? []).slice(0, 8).map((c: any) => (
                  <tr key={c.userId}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td>{c.orders}</Td>
                    <Td className="font-semibold">{formatINR(c.spent)}</Td>
                  </tr>
                ))}
                {(customers?.topSpenders ?? []).length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-sm text-zinc-400">No purchases in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Best sellers" className="lg:col-span-1">
          <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {(products?.bestSellers ?? []).slice(0, 8).map((p: any) => (
              <li key={p.productId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">{p.qty} sold · {formatINR(p.revenue)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Most viewed">
          <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {(products?.mostViewed ?? []).slice(0, 8).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">{p.viewCount} views</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Most wishlisted">
          <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {(products?.mostWishlisted ?? []).slice(0, 8).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">{p.wishlistCount} saves</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
