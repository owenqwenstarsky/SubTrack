import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarRange } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/Alert';
import { getTimeline, type TimelinePayment } from '../lib/api';
import {
  formatDate,
  formatDaysUntil,
  formatMoney,
} from '../lib/format';
import { cn } from '../lib/cn';

const monthOptions = [1, 3, 6, 12, 24, 36];

export function TimelinePage() {
  return (
    <AppShell>
      <TimelineView />
    </AppShell>
  );
}

function TimelineView() {
  const [months, setMonths] = useState(12);
  const [payments, setPayments] = useState<TimelinePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTimeline(months)
      .then((res) => {
        if (!cancelled) setPayments(res.payments);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [months]);

  const grouped = useMemo(() => groupByMonth(payments), [payments]);

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of payments) {
      totals.set(p.currency, (totals.get(p.currency) ?? 0) + Number(p.amount));
    }
    return totals;
  }, [payments]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Payment timeline
            </h1>
            <p className="text-sm text-slate-500">
              Upcoming payments for the next {months}{' '}
              {months === 1 ? 'month' : 'months'}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="months-filter"
              className="text-sm text-slate-600"
            >
              Show
            </label>
            <Select
              id="months-filter"
              value={String(months)}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-36"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  Next {m} {m === 1 ? 'month' : 'months'}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {totalsByCurrency.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(totalsByCurrency.entries()).map(([currency, total]) => (
            <div
              key={currency}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Total · {currency}
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-900">
                {formatMoney(total, currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Spinner className="text-slate-400" />
          <span className="ml-2 text-sm">Loading timeline...</span>
        </div>
      )}

      {!loading && error && <Alert tone="error">{error}</Alert>}

      {!loading && !error && payments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <CalendarRange className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            No upcoming payments
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Add a subscription to see future payments here.
          </p>
          <div className="mt-5">
            <Link to="/subscriptions/new">
              <Button>Add subscription</Button>
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && payments.length > 0 && (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.key}>
              <div className="sticky top-[64px] z-10 -mx-1 mb-3 flex items-center justify-between rounded-md bg-slate-50/90 px-1 py-1 backdrop-blur md:top-[68px]">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </h2>
                <span className="text-xs text-slate-400">
                  {group.items.length}{' '}
                  {group.items.length === 1 ? 'payment' : 'payments'}
                </span>
              </div>

              <ol className="relative space-y-3 border-l border-slate-200 pl-5">
                {group.items.map((payment, index) => (
                  <li
                    key={`${payment.subscription.id}-${payment.paymentDate}-${index}`}
                    className="relative"
                  >
                    <span
                      className={cn(
                        'absolute -left-[26px] top-3 h-3 w-3 rounded-full ring-4 ring-slate-50',
                        payment.daysUntil <= 7
                          ? 'bg-red-500'
                          : payment.daysUntil <= 30
                            ? 'bg-amber-500'
                            : 'bg-slate-300',
                      )}
                      aria-hidden="true"
                    />
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link
                              to={`/subscriptions/${payment.subscription.id}/edit`}
                              className="truncate font-medium text-slate-900 hover:text-slate-700 hover:underline"
                            >
                              {payment.subscription.name}
                            </Link>
                            {payment.subscription.category && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {payment.subscription.category}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(payment.paymentDate)} ·{' '}
                            <span
                              className={cn(
                                'font-medium',
                                payment.daysUntil <= 7
                                  ? 'text-red-600'
                                  : payment.daysUntil <= 30
                                    ? 'text-amber-700'
                                    : 'text-slate-600',
                              )}
                            >
                              {formatDaysUntil(payment.daysUntil)}
                            </span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-base font-semibold tabular-nums text-slate-900">
                            {formatMoney(payment.amount, payment.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type Group = {
  key: string;
  label: string;
  items: TimelinePayment[];
};

function groupByMonth(payments: TimelinePayment[]): Group[] {
  const map = new Map<string, Group>();
  const labelFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  });
  for (const payment of payments) {
    const date = new Date(payment.paymentDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, { key, label: labelFormatter.format(date), items: [] });
    }
    map.get(key)!.items.push(payment);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}
