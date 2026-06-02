import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/ui/Spinner';
import {
  deleteSubscription,
  getSubscriptions,
  type Subscription,
} from '../lib/api';
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
} from '../lib/format';
import { cn } from '../lib/cn';

type LoadState = 'loading' | 'ready' | 'error';

export function SubscriptionsPage() {
  return (
    <AppShell>
      <SubscriptionsView />
    </AppShell>
  );
}

function SubscriptionsView() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setState('loading');
    setError(null);
    getSubscriptions()
      .then((res) => {
        setSubs(res.subscriptions);
        setState('ready');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setState('error');
      });
  };

  useEffect(load, []);

  const summary = useMemo(() => {
    const counts = subs.length;
    const monthlyByCurrency = new Map<string, number>();
    for (const s of subs) {
      const monthly = monthlyEquivalent(s);
      monthlyByCurrency.set(
        s.currency,
        (monthlyByCurrency.get(s.currency) ?? 0) + monthly,
      );
    }
    return { counts, monthlyByCurrency };
  }, [subs]);

  const handleDelete = async (sub: Subscription) => {
    const confirmed = window.confirm(
      `Delete "${sub.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(sub.id);
    try {
      await deleteSubscription(sub.id);
      setSubs((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Failed to delete subscription',
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Spinner className="text-slate-400" />
        <span className="ml-2 text-sm">Loading subscriptions...</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-3">
        <Alert tone="error">{error ?? 'Failed to load subscriptions.'}</Alert>
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (subs.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Subscriptions
          </h1>
          <p className="text-sm text-slate-500">
            {summary.counts} active{' '}
            {summary.counts === 1 ? 'subscription' : 'subscriptions'}
          </p>
        </div>
        {summary.monthlyByCurrency.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(summary.monthlyByCurrency.entries()).map(
              ([currency, amount]) => (
                <div
                  key={currency}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm"
                >
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Monthly · {currency}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatMoney(amount, currency)}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {subs.map((sub) => (
          <SubscriptionCard
            key={sub.id}
            sub={sub}
            onDetails={() => navigate(`/subscriptions/${sub.id}`)}
            onEdit={() => navigate(`/subscriptions/${sub.id}/edit`)}
            onDelete={() => handleDelete(sub)}
            deleting={deletingId === sub.id}
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Interval</th>
              <th className="px-4 py-3">Next payment</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subs.map((sub) => (
              <tr
                key={sub.id}
                className="group transition-colors hover:bg-slate-50/60"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{sub.name}</div>
                  {sub.website && (
                    <a
                      href={sub.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                    >
                      {hostnameOf(sub.website)}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {sub.category ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      <Tag className="h-3 w-3" aria-hidden="true" />
                      {sub.category}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                  {formatMoney(sub.amount, sub.currency)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatBillingInterval(
                    sub.billingInterval,
                    sub.billingIntervalCount,
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(sub.nextPaymentDate)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => navigate(`/subscriptions/${sub.id}`)}
                      aria-label={`View ${sub.name} details`}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        navigate(`/subscriptions/${sub.id}/edit`)
                      }
                      aria-label={`Edit ${sub.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(sub)}
                      disabled={deletingId === sub.id}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${sub.name}`}
                    >
                      {deletingId === sub.id ? (
                        <Spinner className="text-red-500" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscriptionCard({
  sub,
  onDetails,
  onEdit,
  onDelete,
  deleting,
}: {
  sub: Subscription;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {sub.name}
          </h3>
          {sub.category && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              <Tag className="h-3 w-3" aria-hidden="true" />
              {sub.category}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tabular-nums text-slate-900">
            {formatMoney(sub.amount, sub.currency)}
          </div>
          <div className="text-xs text-slate-500">
            {formatBillingInterval(
              sub.billingInterval,
              sub.billingIntervalCount,
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span>Next: {formatDate(sub.nextPaymentDate)}</span>
      </div>

      {sub.website && (
        <a
          href={sub.website}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          {hostnameOf(sub.website)}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onDetails}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          Details
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={deleting}
          className={cn(
            'flex-1 text-red-600 hover:bg-red-50 hover:text-red-700',
            deleting && 'opacity-70',
          )}
        >
          {deleting ? (
            <Spinner className="text-red-500" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
          Delete
        </Button>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Wallet className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">
        No subscriptions yet
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Track recurring payments in one place. Add your first subscription to
        get started.
      </p>
      <div className="mt-5">
        <Link to="/subscriptions/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add subscription
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function monthlyEquivalent(sub: Subscription): number {
  const amount = Number(sub.amount) || 0;
  const count = sub.billingIntervalCount || 1;
  switch (sub.billingInterval) {
    case 'DAILY':
      return (amount / count) * 30;
    case 'WEEKLY':
      return (amount / count) * (52 / 12);
    case 'MONTHLY':
      return amount / count;
    case 'YEARLY':
      return amount / count / 12;
    default:
      return amount;
  }
}
