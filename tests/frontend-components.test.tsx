import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Alert } from '../src/components/Alert';
import { Button } from '../src/components/ui/Button';
import { Field, Input, Select, Textarea } from '../src/components/ui/Field';
import { PageSpinner, Spinner } from '../src/components/ui/Spinner';
import { AuthGuard } from '../src/components/AuthGuard';
import { AppHeader } from '../src/components/AppHeader';
import { SubscriptionForm } from '../src/components/SubscriptionForm';
import { LoginPage } from '../src/pages/LoginPage';
import { SubscriptionsPage } from '../src/pages/SubscriptionsPage';
import { TimelinePage } from '../src/pages/TimelinePage';
import { SubscriptionDetailsPage } from '../src/pages/SubscriptionDetailsPage';
import { AddSubscriptionPage } from '../src/pages/AddSubscriptionPage';
import { EditSubscriptionPage } from '../src/pages/EditSubscriptionPage';
import type { Subscription, SubscriptionDetails, TimelinePayment } from '../src/lib/api';

vi.mock('../src/lib/api', async () => {
  return {
    getAuthStatus: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getSubscriptions: vi.fn(),
    getSubscription: vi.fn(),
    getSubscriptionDetails: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    getTimeline: vi.fn(),
  };
});

const api = await import('../src/lib/api');
const mocked = api as unknown as Record<keyof typeof api, ReturnType<typeof vi.fn>>;

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub_1',
  name: 'Netflix',
  description: 'Streaming',
  amount: '12',
  currency: 'USD',
  billingInterval: 'MONTHLY',
  billingIntervalCount: 1,
  firstPaymentDate: '2026-01-01T00:00:00.000Z',
  nextPaymentDate: '2026-02-01T00:00:00.000Z',
  category: 'Entertainment',
  website: 'https://www.netflix.com',
  notes: 'Family plan',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function renderWithRouter(ui: React.ReactNode, initialEntries = ['/'], routePath = '/') {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path={routePath} element={ui} />
        <Route path="/" element={<div>Home route</div>} />
        <Route path="/login" element={<div>Login route</div>} />
        <Route path="/subscriptions/new" element={<div>New route</div>} />
        <Route path="/subscriptions/:id" element={<div>Details route</div>} />
        <Route path="/subscriptions/:id/edit" element={<div>Edit route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const value of Object.values(mocked)) value.mockReset?.();
  mocked.getAuthStatus.mockResolvedValue({ authenticated: true });
});

describe('shared UI components', () => {
  it('renders alert tones, buttons, fields, inputs, selects, textareas, and spinners', () => {
    render(
      <div>
        <Alert tone="info" className="custom">Info</Alert>
        <Alert tone="success">Success</Alert>
        <Alert>Error</Alert>
        <Button variant="secondary" size="lg">Go</Button>
        <Spinner />
        <PageSpinner label="Please wait" />
        <Field label="Email" required hint="Hint text" error={null}>{(props) => <Input {...props} />}</Field>
        <Field label="Bio" error="Bad bio">{(props) => <Textarea {...props} />}</Field>
        <Select defaultValue="a"><option value="a">A</option></Select>
      </div>,
    );
    expect(screen.getByText('Please wait')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Error');
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('h-11');
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Hint text')).toBeInTheDocument();
    expect(screen.getByText('Bad bio')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('protects authenticated routes and redirects guests', async () => {
    renderWithRouter(<AuthGuard><div>Secret</div></AuthGuard>);
    expect(await screen.findByText('Secret')).toBeInTheDocument();

    mocked.getAuthStatus.mockRejectedValueOnce(new Error('no session'));
    renderWithRouter(<AuthGuard><div>Hidden</div></AuthGuard>);
    expect(await screen.findByText('Login route')).toBeInTheDocument();
  });

  it('renders header navigation and logs out even if logout fails', async () => {
    mocked.logout.mockRejectedValue(new Error('ignored'));
    const user = userEvent.setup();
    renderWithRouter(<><AppHeader /><div>Home</div></>);
    expect(screen.getByLabelText('Subtrack home')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(mocked.logout).toHaveBeenCalled());
    expect(await screen.findByText('Login route')).toBeInTheDocument();
  });
});

describe('subscription form', () => {
  it('validates, clears field errors, submits transformed data, handles cancel and server errors', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('server failed')).mockResolvedValueOnce(undefined);
    const onCancel = vi.fn();
    render(<SubscriptionForm submitLabel="Save" onSubmit={onSubmit} onCancel={onCancel} extraActions={<button type="button">Extra</button>} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Name/), 'Netflix');
    await user.type(screen.getByLabelText(/Amount/), '12.34');
    await user.clear(screen.getByLabelText(/Website/));
    await user.type(screen.getByLabelText(/Website/), 'https://netflix.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('server failed');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ name: 'Netflix', amount: 12.34, website: 'https://netflix.com' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  });
});

describe('pages', () => {
  it('handles login initial states, validation, show/hide password, success and failure', async () => {
    const user = userEvent.setup();
    mocked.getAuthStatus.mockResolvedValueOnce({ authenticated: false });
    mocked.login.mockRejectedValueOnce(new Error('bad')).mockResolvedValueOnce({ authenticated: true, csrfToken: 'csrf' });
    renderWithRouter(<LoginPage />, ['/login'], '/login');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password');
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText(/Password/)).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocked.login).toHaveBeenCalledTimes(2));
  });

  it('shows subscriptions empty, error/retry, summary, links, and delete flows', async () => {
    const user = userEvent.setup();
    mocked.getSubscriptions.mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce({ subscriptions: [] }).mockResolvedValueOnce({ subscriptions: [sub(), sub({ id: 'sub_2', name: 'Gym', amount: '7', currency: 'EUR', billingInterval: 'WEEKLY', billingIntervalCount: 1, category: null, website: null })] });
    mocked.deleteSubscription.mockRejectedValueOnce(new Error('delete failed')).mockResolvedValueOnce(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);

    renderWithRouter(<SubscriptionsPage />);
    expect(await screen.findByText('load failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument();

    cleanup();
    renderWithRouter(<SubscriptionsPage />);
    expect(await screen.findByText('2 active subscriptions')).toBeInTheDocument();
    expect(screen.getAllByText('netflix.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Monthly · USD')).toBeInTheDocument();
    expect(screen.getByText('Monthly · EUR')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /delete netflix/i })[0]);
    expect(mocked.deleteSubscription).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole('button', { name: /delete netflix/i })[0]);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('delete failed'));
    await user.click(screen.getAllByRole('button', { name: /delete netflix/i })[0]);
    await waitFor(() => expect(screen.queryAllByText('Netflix')).toHaveLength(0));
  });

  it('renders timeline loading, error, empty, grouped payments, totals, and filter changes', async () => {
    const user = userEvent.setup();
    const payment = (daysUntil: number, paymentDate: string, amount = '10'): TimelinePayment => ({ subscription: sub({ id: `sub_${daysUntil}`, name: `Sub ${daysUntil}` }), paymentDate, daysUntil, amount, currency: 'USD' });
    mocked.getTimeline.mockRejectedValueOnce(new Error('timeline failed')).mockResolvedValueOnce({ payments: [] }).mockResolvedValueOnce({ payments: [payment(5, '2026-01-05T12:00:00.000Z'), payment(20, '2026-01-20T12:00:00.000Z'), payment(40, '2026-02-01T12:00:00.000Z', '20')] }).mockResolvedValueOnce({ payments: [] });

    renderWithRouter(<TimelinePage />, ['/timeline'], '/timeline');
    expect(await screen.findByText('timeline failed')).toBeInTheDocument();
    cleanup();
    renderWithRouter(<TimelinePage />, ['/timeline'], '/timeline');
    expect(await screen.findByText('No upcoming payments')).toBeInTheDocument();
    cleanup();
    renderWithRouter(<TimelinePage />, ['/timeline'], '/timeline');
    expect(await screen.findByText('Total · USD')).toBeInTheDocument();
    expect(screen.getByText('January 2026')).toBeInTheDocument();
    expect(screen.getByText('February 2026')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Show'), '3');
    await waitFor(() => expect(mocked.getTimeline).toHaveBeenLastCalledWith(3));
  });

  it('renders subscription details error, retry, empty and populated past payments, and delete dialog flows', async () => {
    const user = userEvent.setup();
    const details: SubscriptionDetails = { subscription: sub(), pastPayments: [], stats: { paymentsMade: 0, totalPaid: '0', currency: 'USD', daysUntilNextPayment: -1 } };
    const populated: SubscriptionDetails = { subscription: sub(), pastPayments: [{ paymentDate: '2026-01-01T00:00:00.000Z', amount: '12', currency: 'USD' }], stats: { paymentsMade: 1, totalPaid: '12', currency: 'USD', daysUntilNextPayment: 3 } };
    mocked.getSubscriptionDetails.mockRejectedValueOnce(new Error('details failed')).mockResolvedValueOnce(details).mockResolvedValueOnce(populated);
    mocked.deleteSubscription.mockRejectedValueOnce(new Error('cannot delete')).mockResolvedValueOnce(undefined);

    renderWithRouter(<SubscriptionDetailsPage />, ['/subscriptions/sub_1'], '/subscriptions/:id');
    expect(await screen.findByText('details failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('No past payments yet')).toBeInTheDocument();

    cleanup();
    renderWithRouter(<SubscriptionDetailsPage />, ['/subscriptions/sub_1'], '/subscriptions/:id');
    expect(await screen.findByText('Family plan')).toBeInTheDocument();
    expect(screen.getByText(/Total\s*·\s*USD/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot delete');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(mocked.deleteSubscription).toHaveBeenCalledTimes(2));
  });

  it('creates and edits subscriptions including loading, load errors, submit, delete cancel and errors', async () => {
    const user = userEvent.setup();
    mocked.createSubscription.mockResolvedValue({ subscription: sub() });
    mocked.getSubscription.mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce({ subscription: sub() }).mockResolvedValueOnce({ subscription: sub({ name: 'Delete me' }) });
    mocked.updateSubscription.mockResolvedValue({ subscription: sub({ name: 'Saved' }) });
    mocked.deleteSubscription.mockRejectedValueOnce(new Error('delete error')).mockResolvedValueOnce(undefined);
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);

    renderWithRouter(<AddSubscriptionPage />, ['/subscriptions/new'], '/subscriptions/new');
    expect(await screen.findByText('Add subscription')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Name/), 'New sub');
    await user.type(screen.getByLabelText(/Amount/), '8');
    await user.click(screen.getByRole('button', { name: /create subscription/i }));
    await waitFor(() => expect(mocked.createSubscription).toHaveBeenCalled());

    renderWithRouter(<EditSubscriptionPage />, ['/subscriptions/sub_1/edit'], '/subscriptions/:id/edit');
    expect(await screen.findByText('missing')).toBeInTheDocument();

    cleanup();
    renderWithRouter(<EditSubscriptionPage />, ['/subscriptions/sub_1/edit'], '/subscriptions/:id/edit');
    expect(await screen.findByDisplayValue('Netflix')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(mocked.deleteSubscription).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/Name/));
    await user.type(screen.getByLabelText(/Name/), 'Changed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mocked.updateSubscription).toHaveBeenCalled());

    cleanup();
    renderWithRouter(<EditSubscriptionPage />, ['/subscriptions/sub_1/edit'], '/subscriptions/:id/edit');
    expect(await screen.findByDisplayValue('Delete me')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('delete error');
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => expect(mocked.deleteSubscription).toHaveBeenCalledTimes(2));
  });
});
