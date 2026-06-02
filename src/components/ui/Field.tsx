import { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn';

const inputBase =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ' +
  'text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors ' +
  'focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cn(inputBase, className)} {...rest} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...rest }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(inputBase, 'min-h-[80px] resize-y', className)}
    {...rest}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...rest }, ref) => (
  <select
    ref={ref}
    className={cn(inputBase, 'pr-9 appearance-none bg-no-repeat', className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
      backgroundPosition: 'right 0.6rem center',
      backgroundSize: '1.1rem',
    }}
    {...rest}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean }) => React.ReactNode;
};

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-slate-700"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error) || undefined })}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
