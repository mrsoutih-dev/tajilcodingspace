import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="my-3 rounded-lg border border-ink-700 bg-ink-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-900 border-b border-ink-700">
        <span className="text-xs text-ink-500 font-mono">{language ?? 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100 transition-colors">
          {copied ? <Check size={12} className="text-success-400" /> : <Copy size={12} />}
          {copied ? t('chat.copied') : t('chat.copy')}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed font-mono text-ink-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
