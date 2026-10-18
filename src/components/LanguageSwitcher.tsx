import { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

export function LanguageSwitcher() {
  const { language, setLanguage, languages } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = languages.find((l) => l.code === language) ?? languages[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost h-9 px-2.5"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
      >
        <Globe size={16} />
        <span className="text-xs font-medium uppercase">{current.code}</span>
      </button>
      {open && (
        <ul
          className="absolute end-0 mt-1 w-44 surface-raised shadow-card py-1 z-50 animate-fade-in"
          role="listbox"
        >
          {languages.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 transition-colors"
                role="option"
                aria-selected={l.code === language}
              >
                <span>
                  <span className="text-ink-100">{l.nativeLabel}</span>
                  <span className="text-ink-500 ms-2">· {l.label}</span>
                </span>
                {l.code === language && <Check size={14} className="text-brand-400" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
