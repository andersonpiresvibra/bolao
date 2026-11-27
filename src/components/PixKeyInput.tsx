import React, { useState, useEffect } from 'react';
import { maskCpfInput, maskPhoneInput } from '../utils/inputMasks';

export type PixKeyMode = 'CPF' | 'PHONE' | 'EMAIL' | 'RANDOM';

interface PixKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  prefillCpf?: string;
  prefillPhone?: string;
  prefillEmail?: string;
  helperText?: string;
}

function detectPixKeyMode(val: string): PixKeyMode {
  const trimmed = String(val || '').trim();
  if (!trimmed) return 'PHONE';
  if (trimmed.includes('@')) return 'EMAIL';
  if (trimmed.startsWith('(') || trimmed.startsWith('+')) return 'PHONE';
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed)) return 'CPF';
  if (/[a-zA-Z]/.test(trimmed)) return 'RANDOM';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && trimmed.includes('.')) return 'CPF';
  return 'PHONE';
}

function formatByMode(raw: string, mode: PixKeyMode): string {
  if (mode === 'CPF') return maskCpfInput(raw);
  if (mode === 'PHONE') return maskPhoneInput(raw);
  if (mode === 'EMAIL') return raw.replace(/\s+/g, '');
  return raw.trimStart();
}

const MODE_OPTIONS: {
  id: PixKeyMode;
  label: string;
  placeholder: string;
  inputType: string;
  inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}[] = [
  {
    id: 'CPF',
    label: 'CPF',
    placeholder: '000.000.000-00',
    inputType: 'text',
    inputMode: 'numeric',
  },
  {
    id: 'PHONE',
    label: 'Celular',
    placeholder: '(11) 91234-5678',
    inputType: 'tel',
    inputMode: 'tel',
  },
  {
    id: 'EMAIL',
    label: 'E-mail',
    placeholder: 'nome@email.com',
    inputType: 'email',
    inputMode: 'email',
  },
  {
    id: 'RANDOM',
    label: 'Aleatória',
    placeholder: 'Chave aleatória (EVP)',
    inputType: 'text',
    inputMode: 'text',
  },
];

export const PixKeyInput: React.FC<PixKeyInputProps> = ({
  value,
  onChange,
  label = 'Chave Pix',
  required = true,
  prefillCpf,
  prefillPhone,
  prefillEmail,
  helperText,
}) => {
  const [mode, setMode] = useState<PixKeyMode>(() => detectPixKeyMode(value));

  // Sync mode if external value changes from empty to prefilled
  useEffect(() => {
    if (value && value.trim()) {
      const detected = detectPixKeyMode(value);
      if (
        (detected === 'EMAIL' && mode !== 'EMAIL') ||
        (detected === 'RANDOM' && mode !== 'RANDOM' && mode !== 'EMAIL')
      ) {
        setMode(detected);
      }
    }
  }, [value]);

  const activeConfig = MODE_OPTIONS.find((m) => m.id === mode) || MODE_OPTIONS[1];

  const handleSelectMode = (nextMode: PixKeyMode) => {
    setMode(nextMode);
    const trimmed = value.trim();

    if (nextMode === 'CPF') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length > 0 && !trimmed.includes('@') && !/[a-zA-Z]/.test(trimmed)) {
        onChange(maskCpfInput(digits));
      } else if (!trimmed && prefillCpf && prefillCpf.replace(/\D/g, '').length === 11) {
        onChange(maskCpfInput(prefillCpf));
      } else if (trimmed.includes('@') || /[a-zA-Z]/.test(trimmed)) {
        onChange(
          prefillCpf && prefillCpf.replace(/\D/g, '').length === 11
            ? maskCpfInput(prefillCpf)
            : ''
        );
      }
      return;
    }

    if (nextMode === 'PHONE') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length > 0 && !trimmed.includes('@') && !/[a-zA-Z]/.test(trimmed)) {
        onChange(maskPhoneInput(digits));
      } else if (!trimmed && prefillPhone && prefillPhone.replace(/\D/g, '').length >= 10) {
        onChange(maskPhoneInput(prefillPhone));
      } else if (trimmed.includes('@') || /[a-zA-Z]/.test(trimmed)) {
        onChange(
          prefillPhone && prefillPhone.replace(/\D/g, '').length >= 10
            ? maskPhoneInput(prefillPhone)
            : ''
        );
      }
      return;
    }

    if (nextMode === 'EMAIL') {
      if (!trimmed || !trimmed.includes('@')) {
        onChange(prefillEmail ? prefillEmail.trim() : '');
      }
      return;
    }

    // RANDOM
    if (trimmed && (/^[\d.()-\s]+$/.test(trimmed) || trimmed.includes('@'))) {
      onChange('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block font-semibold text-[#333E48]">
          {label} {required ? '*' : '(opcional)'}
        </label>
        <div
          className="inline-flex items-center rounded-[4px] border border-[#D5E0EC] bg-[#F7F9FC] p-0.5 gap-0.5"
          role="group"
          aria-label="Tipo de máscara da Chave Pix"
        >
          {MODE_OPTIONS.map((opt) => {
            const active = opt.id === mode;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectMode(opt.id)}
                className={`px-2 py-1 text-[10px] font-bold rounded-[3px] transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#005CA9] text-white shadow-xs'
                    : 'text-[#5F6C7B] hover:text-[#005CA9] hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <input
        type={activeConfig.inputType}
        inputMode={activeConfig.inputMode}
        required={required}
        value={value}
        onChange={(e) => onChange(formatByMode(e.target.value, mode))}
        placeholder={activeConfig.placeholder}
        className="caixa-input font-mono-tabular"
      />

      {helperText && (
        <p className="text-[10px] text-[#5F6C7B] leading-snug">{helperText}</p>
      )}
    </div>
  );
};
