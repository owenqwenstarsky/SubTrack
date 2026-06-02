import { AlertCircle } from 'lucide-react';
import { cn } from '../lib/cn';

type Tone = 'error' | 'info' | 'success';

const tones: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        tones[tone],
        className,
      )}
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
