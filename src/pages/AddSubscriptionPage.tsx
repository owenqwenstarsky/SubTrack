import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { SubscriptionForm } from '../components/SubscriptionForm';
import { createSubscription } from '../lib/api';

export function AddSubscriptionPage() {
  return (
    <AppShell>
      <AddSubscriptionView />
    </AppShell>
  );
}

function AddSubscriptionView() {
  const navigate = useNavigate();

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
          Add subscription
        </h1>
        <p className="text-sm text-slate-500">
          Track a new recurring payment.
        </p>
      </div>

      <SubscriptionForm
        submitLabel="Create subscription"
        onCancel={() => navigate('/')}
        onSubmit={async (input) => {
          await createSubscription(input);
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}
