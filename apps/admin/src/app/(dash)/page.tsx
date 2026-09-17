'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowRight, IndianRupee, Package, RotateCcw, ShoppingBag, TrendingUp, Users,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { Card, Spinner } from '@/components/ui';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '3 months' },
  { value: '180d', label: '6 months' },
  { value: '1y', label: '1 year' },
];

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

function StatCard({
  label, value, sub, icon: Icon, tone = 'brand', href,
}: {
  label: string; value: string; sub?: string; icon: any; tone?: 'brand' | 'green' | 'amber' | 'rose'; href?: string;
}) {
  const tones = {
    brand: 'bg-brand-100 text-brand-600 dark:bg-brand-900/40',
    green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40',
  };
  const inner = (
    <div className="flex items-start justify-between rounded-xl border border-zinc-200/80 bg-white p-4 transition hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </div>
      <span className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-5" />
      </span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [range, setRange] = useState('30d');

  const { data: kpi, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<any>('/admin/reports/dashboard'),
  });
  const { data: charts } = useQuery({
    queryKey: ['charts', range],
    queryFn: () => api.get<any>(`/admin/reports/charts?range=${range}`),
  });

  if (isLoading || !kpi) return <Spinner />;

  const revenueData = (charts?.revenueByDay ?? []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenue: r.revenue,
    orders: r.orders,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-zinc-400">Your store at a glance</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          aria-label="Date range"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total sales" value={formatINR(kpi.sales.total)} sub={`Today: ${formatINR(kpi.sales.today)} (${kpi.sales.todayOrders} orders)`} icon={IndianRupee} tone="green" />
        <StatCard label="Orders" value={String(kpi.orders.total)} sub={`${kpi.orders.pending} to fulfil · ${kpi.orders.shipped} in transit`} icon={Package} href="/orders" />
        <StatCard label="Customers" value={String(kpi.customers.total)} sub={`+${kpi.customers.newThisMonth} this month`} icon={Users} href="/customers" />
        <StatCard label="30-day sales" value={formatINR(kpi.sales.month)} sub={`7-day: ${formatINR(kpi.sales.week)}`} icon={TrendingUp} tone="brand" />
      </div>

      {/* Attention row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Low stock" value={String(kpi.products.lowStock)} sub={`${kpi.products.outOfStock} out of stock`} icon={AlertTriangle} tone="amber" href="/inventory?filter=low" />
        <StatCard label="Returns pending" value={String(kpi.orders.returnsPending)} sub={`${kpi.orders.refundsPending} refunds in flight`} icon={RotateCcw} tone="rose" href="/returns" />
        <StatCard label="Active products" value={String(kpi.products.active)} icon={ShoppingBag} href="/products" />
        <StatCard label="Abandoned carts" value={String(kpi.marketing.abandonedCarts)} sub={`${kpi.marketing.activeCoupons} live coupons · ${kpi.marketing.activeOffers} offers`} icon={ShoppingBag} tone="amber" href="/marketing/abandoned-carts" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Revenue" className="lg:col-span-2">
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip formatter={(v: number, name) => (name === 'revenue' ? formatINR(v) : v)} />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Payment methods">
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.paymentMethods ?? []}
                  dataKey="value"
                  nameKey="method"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                >
                  {(charts?.paymentMethods ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend formatter={(v) => String(v).toUpperCase()} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top products" actions={<Link href="/reports" className="flex items-center gap-1 text-xs font-semibold text-brand-600">Full report <ArrowRight className="size-3.5" /></Link>}>
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(charts?.topProducts ?? []).slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v.length > 22 ? v.slice(0, 22) + '…' : v)} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Orders by status">
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.ordersByStatus ?? []} margin={{ top: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.replaceAll('_', ' ').toLowerCase()} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
