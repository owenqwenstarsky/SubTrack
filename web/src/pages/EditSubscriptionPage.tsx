import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import {
  SubscriptionForm,
  SubscriptionFormValues,
  subscriptionToFormValues,
} from '../components/SubscriptionForm';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/Alert';
import {
  deleteSubscription,
  getSubscription,
  updateSubscription,
} from '../lib/api';

export function EditSubscriptionPage() {
  return (
    <AppShell>
      <EditSubscriptionView />
    </AppShell>
  );
}

function EditSubscriptionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<SubscriptionFormValues | null>(null);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getSubscription(id)
      .then((res) => {
        if (cancelled) return;
        setInitial(subscriptionToFormValues(res.subscription));
        setName(res.subscription.name);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Failed to load subscription',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      `Delete "${name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Spinner className="text-slate-400" />
        <span className="ml-2 text-sm">Loading subscription...</span>
      </div>
    );
  }

  if (loadError || !initial || !id) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Alert tone="error">
          {loadError ?? 'Subscription not found.'}
        </Alert>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to subscriptions
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to subscriptions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Edit subscription
        </h1>
        <p className="text-sm text-slate-500">
          Update billing details or remove this subscription.
        </p>
      </div>

      {deleteError && <Alert tone="error">{deleteError}</Alert>}

      <SubscriptionForm
        initialValues={initial}
        submitLabel="Save changes"
        onCancel={() => navigate('/')}
        onSubmit={async (input) => {
          await updateSubscription(id, input);
          navigate('/', { replace: true });
        }}
        extraActions={
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 sm:mr-auto"
          >
            {deleting ? (
              <Spinner className="text-red-500" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            Delete
          </Button>
        }
      />
    </div>
  );
}
