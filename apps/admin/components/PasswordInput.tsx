'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type Props = {
  value: string;
  onChange: (v: string) => void;
  name: string;
  id?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
};

// Mirror of apps/pwa/components/PasswordInput — kept duplicated per-app so
// each can evolve styling independently and neither pulls a UI component out
// of the @aisie/shared (types-only) package.
export function PasswordInput({
  value,
  onChange,
  name,
  id,
  autoComplete = 'current-password',
  required,
  placeholder,
  className,
}: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? name;
  const Icon = visible ? EyeOff : Eye;
  const label = visible ? 'Şifreyi gizle' : 'Şifreyi göster';

  return (
    <div className={cn('relative w-full', className)}>
      <Input
        type={visible ? 'text' : 'password'}
        name={name}
        id={inputId}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
