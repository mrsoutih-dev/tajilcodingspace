import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'success' | 'warning' | 'error';
  createdAt: number;
  read: boolean;
}

let _notifications: AppNotification[] = [];
const listeners = new Set<() => void>();

export function pushNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  const entry: AppNotification = {
    ...n,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    read: false,
  };
  _notifications = [entry, ..._notifications].slice(0, 50);
  listeners.forEach((l) => l());
}

export function markAllRead() {
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
  listeners.forEach((l) => l());
}

function useNotifications() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return _notifications;
}

export function NotificationsMenu() {
  const { t } = useI18n();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost h-9 w-9 p-0 justify-center relative"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.title')}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-brand-400 ring-2 ring-ink-950" />
        )}
      </button>
      {open && (
        <div className="absolute end-0 mt-1 w-80 surface-raised shadow-card z-50 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800">
            <span className="text-sm font-semibold text-ink-100">{t('notifications.title')}</span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100"
              >
                <CheckCheck size={12} /> {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">{t('notifications.empty')}</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-ink-800/60 last:border-0 ${n.read ? '' : 'bg-brand-500/[0.03]'}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                        n.level === 'error'
                          ? 'bg-error-400'
                          : n.level === 'warning'
                          ? 'bg-warning-400'
                          : n.level === 'success'
                          ? 'bg-success-400'
                          : 'bg-brand-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-100">{n.title}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-ink-600 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
