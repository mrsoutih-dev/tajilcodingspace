import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n/I18nContext';
import { CodeBlock } from '@/components/CodeBlock';

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:font-semibold [&_h3]:mt-2 [&_blockquote]:border-s-2 [&_blockquote]:border-ink-600 [&_blockquote]:ps-3 [&_blockquote]:text-ink-400 [&_a]:text-brand-400 [&_a]:underline [&_table]:text-xs [&_th]:border [&_th]:border-ink-700 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-ink-700 [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '');
            const text = String(children).replace(/\n$/, '');
            if (match || text.includes('\n')) {
              return <CodeBlock code={text} language={match?.[1]} />;
            }
            return (
              <code className="bg-ink-800 rounded px-1 py-0.5 text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function useCopy() {
  const { t } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  function copy(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }
  return { copiedId, copy, copiedLabel: t('chat.copied'), copyLabel: t('chat.copy') };
}
