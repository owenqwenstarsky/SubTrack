import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  ExternalLink,
  Hash,
  History,
  Pencil,
  Receipt,
  Repeat,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Alert } from '../components/Alert';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import {
  deleteSubscription,
  getSubscriptionDetails,
  type SubscriptionDetails,
} from '../lib/api';
import {
  formatBillingInterval,
  formatDate,
  formatDaysUntil,
  formatMoney,
} from '../lib/format';
import { cn } from '../lib/cn';

type LoadState = 'loading' | 'ready' | 'error';

export function SubscriptionDetailsPage() {
  return (
    <AppShell>
      <SubscriptionDetailsView />
    </AppShell>
  );
}

function SubscriptionDetailsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setState('loading');
    setError(null);
    getSubscriptionDetails(id)
      .then((res) => {
        setDetails(res);
        setState('ready');
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load subscription',
        );
        setState('error');
      });
  };

  useEffect(load, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSubscription(id);
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete subscription',
      );
      setDeleting(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Spinner className="text-slate-400" />
        <span className="ml-2 text-sm">Loading subscription...</span>
      </div>
    );
  }

  if (state === 'error' || !details) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Alert tone="error">{error ?? 'Subscription not found.'}</Alert>
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to subscriptions
            </Button>
          </Link>
          {id && (
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { subscription, pastPayments, stats } = details;
  const nextPaymentLabel = formatDate(subscription.nextPaymentDate);
  const daysUntilLabel = formatDaysUntil(stats.daysUntilNextPayment);
  const cadenceLabel = formatBillingInterval(
    subscription.billingInterval,
    subscription.billingIntervalCount,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to subscriptions
        </Link>
      </div>

      {deleteError && <Alert tone="error">{deleteError}</Alert>}

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {subscription.name}
              </h1>
              {subscription.category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  {subscription.category}
                </span>
              )}
            </div>
            {subscription.description && (
              <p className="max-w-2xl text-sm text-slate-600">
                {subscription.description}
              </p>
            )}
            {subscription.website && (
              <a
                href={subscription.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
              >
                {hostnameOf(subscription.website)}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
            <Link to={`/subscriptions/${subscription.id}/edit`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      </header>

      <section
        aria-label="Subscription statistics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          label="Total paid"
          value={formatMoney(stats.totalPaid, stats.currency)}
          hint={`${stats.paymentsMade} ${stats.paymentsMade === 1 ? 'payment' : 'payments'} so far`}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
          label="Payments made"
          value={String(stats.paymentsMade)}
          hint={
            stats.paymentsMade === 0
              ? 'No payments yet'
              : `Since ${formatDate(subscription.firstPaymentDate)}`
          }
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
          label="Next payment"
          value={nextPaymentLabel}
          hint={daysUntilLabel}
          hintTone={
            stats.daysUntilNextPayment < 0
              ? 'danger'
              : stats.daysUntilNextPayment <= 7
                ? 'warn'
                : 'muted'
          }
        />
        <StatCard
          icon={<Repeat className="h-4 w-4" aria-hidden="true" />}
          label="Billing cadence"
          value={cadenceLabel}
          hint={formatMoney(subscription.amount, subscription.currency)}
        />
      </section>

      <section
        aria-label="Subscription details"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Details
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <DetailRow
            icon={<Hash className="h-4 w-4" aria-hidden="true" />}
            label="Amount"
            value={formatMoney(subscription.amount, subscription.currency)}
          />
          <DetailRow
            icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
            label="Currency"
            value={subscription.currency}
          />
          <DetailRow
            icon={<Repeat className="h-4 w-4" aria-hidden="true" />}
            label="Billing interval"
            value={cadenceLabel}
          />
          <DetailRow
            icon={<Hash className="h-4 w-4" aria-hidden="true" />}
            label="Interval count"
            value={String(subscription.billingIntervalCount)}
          />
          <DetailRow
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
            label="First payment"
            value={formatDate(subscription.firstPaymentDate)}
          />
          <DetailRow
            icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
            label="Next payment"
            value={`${nextPaymentLabel} · ${daysUntilLabel}`}
          />
        </dl>
        {subscription.notes && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Notes
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {subscription.notes}
            </p>
          </div>
        )}
      </section>

      <PastPaymentsSection details={details} />

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          name={subscription.name}
          deleting={deleting}
          onCancel={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function PastPaymentsSection({ details }: { details: SubscriptionDetails }) {
  const { pastPayments } = details;

  const total = useMemo(() => {
    if (pastPayments.length === 0) return null;
    const currency = pastPayments[0].currency;
    const sum = pastPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    return { sum, currency };
  }, [pastPayments]);

  return (
    <section aria-label="Past payments" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Past payments
          </h2>
          <p className="text-sm text-slate-500">
            {pastPayments.length === 0
              ? 'No payments recorded yet.'
              : `${pastPayments.length} ${
                  pastPayments.length === 1 ? 'payment' : 'payments'
                } recorded`}
          </p>
        </div>
        {total && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Total · {total.currency}
            </div>
            <div className="text-sm font-semibold tabular-nums text-slate-900">
              {formatMoney(total.sum, total.currency)}
            </div>
          </div>
        )}
      </div>

      {pastPayments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <History className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="text-base font-semibold text-slate-900">
            No past payments yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Payments will appear here once they have been billed.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {pastPayments.map((payment, index) => (
              <li
                key={`${payment.paymentDate}-${index}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Receipt className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {formatDate(payment.paymentDate)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {payment.currency}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoney(payment.amount, payment.currency)}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Currency
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastPayments.map((payment, index) => (
                  <tr
                    key={`${payment.paymentDate}-${index}`}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {payment.currency}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatMoney(payment.amount, payment.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  hintTone = 'muted',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'muted' | 'warn' | 'danger';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-3 text-xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            'mt-1 text-xs',
            hintTone === 'danger' && 'text-red-600',
            hintTone === 'warn' && 'text-amber-700',
            hintTone === 'muted' && 'text-slate-500',
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  name,
  deleting,
  onCancel,
  onConfirm,
}: {
  name: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="delete-dialog-title"
              className="text-base font-semibold text-slate-900"
            >
              Delete subscription
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-medium text-slate-900">{name}</span>? This
              action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={deleting}
            aria-label={`Confirm delete ${name}`}
          >
            {deleting ? (
              <>
                <Spinner className="text-white" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
