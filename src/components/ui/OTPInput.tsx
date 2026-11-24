// Kazi OTP Input Component (6 digits for +241 Gabon Phone Verification)

import React, { useRef } from 'react';

export interface OTPInputProps {
  value: string;
  onChange: (otp: string) => void;
  phone?: string;
  onResend?: () => void;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChange,
  phone = '+241 07 90 11 22',
  onResend,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return;
    const current = value.padEnd(6, ' ').split('');
    current[index] = char.slice(-1) || ' ';
    const nextVal = current.join('').trimEnd();
    onChange(nextVal);

    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Code de confirmation envoyé par SMS au <strong style={{ color: 'var(--color-text)' }}>{phone}</strong>
      </p>

      <div style={{ display: 'flex', gap: '8px' }}>
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputsRef.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[idx]?.trim() || ''}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            style={{
              width: '44px',
              height: '52px',
              fontSize: '22px',
              fontWeight: 700,
              textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: `2px solid ${
                digits[idx]?.trim() ? 'var(--color-primary)' : 'var(--color-control-border)'
              }`,
              borderRadius: 'var(--radius-input)',
              outline: 'none',
            }}
          />
        ))}
      </div>

      {onResend && (
        <button
          onClick={onResend}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Renvoyer le code SMS (disponible après 30s)
        </button>
      )}
    </div>
  );
};
