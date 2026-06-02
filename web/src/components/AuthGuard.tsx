import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthStatus } from '../lib/api';
import { PageSpinner } from './ui/Spinner';

type Status = 'checking' | 'authed' | 'guest';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((result) => {
        if (cancelled) return;
        if (result.authenticated) {
          setStatus('authed');
        } else {
          setStatus('guest');
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('guest');
        navigate('/login', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status !== 'authed') {
    return <PageSpinner />;
  }
  return <>{children}</>;
}
