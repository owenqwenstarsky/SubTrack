import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CalendarClock, LayoutGrid, LogOut, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { logout } from '../lib/api';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { cn } from '../lib/cn';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

export function AppHeader() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Ignore logout errors; navigate anyway.
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-900"
          aria-label="Subtrack home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Subtrack</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <NavLink to="/" end className={linkClass}>
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            Subscriptions
          </NavLink>
          <NavLink to="/timeline" className={linkClass}>
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Timeline
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/subscriptions/new')}
            className="hidden sm:inline-flex"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
          <Button
            size="icon"
            variant="primary"
            onClick={() => navigate('/subscriptions/new')}
            className="sm:hidden"
            aria-label="Add subscription"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
          >
            {loggingOut ? (
              <Spinner className="text-slate-500" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      <nav
        className="flex items-center gap-1 border-t border-slate-200 px-2 py-2 md:hidden"
        aria-label="Mobile primary"
      >
        <NavLink to="/" end className={linkClass}>
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          Subscriptions
        </NavLink>
        <NavLink to="/timeline" className={linkClass}>
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          Timeline
        </NavLink>
      </nav>
    </header>
  );
}
