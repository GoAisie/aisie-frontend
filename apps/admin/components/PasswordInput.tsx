'use client';

import { useState, type CSSProperties } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  name: string;
  id?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  style?: CSSProperties;
};

// Mirror of apps/pwa/components/PasswordInput — kept duplicated per-app so
// each can evolve styling independently and neither pulls a UI component out
// of the @aisie/shared (types-only) package. The interaction contract
// (visible/hidden toggle that preserves the controlled value) is identical.
export function PasswordInput({
  value,
  onChange,
  name,
  id,
  autoComplete = 'current-password',
  required,
  placeholder,
  style,
}: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? name;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        id={inputId}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: '1px solid #d4d4d8',
          borderRadius: 8,
          padding: '10px 44px 10px 12px',
          fontSize: 15,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          ...style,
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
        aria-pressed={visible}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: '#6b6b74',
          cursor: 'pointer',
          fontSize: 13,
          padding: '4px 8px',
          fontWeight: 500,
        }}
      >
        {visible ? 'Gizle' : 'Göster'}
      </button>
    </div>
  );
}
