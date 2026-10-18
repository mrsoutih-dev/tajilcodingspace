import { useEffect, useState, type FormEvent } from 'react';
import { User, Globe, Lock, Palette, Loader2, Check, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { branding } from '@/config/branding';

export function SettingsPage() {
  const { t, language, setLanguage, languages } = useI18n();
  const { user, updatePassword } = useAuth();

  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [role, setRole] = useState('user');

  useEffect(() => {
    if (!user) return;
    setFullName((user.user_metadata?.full_name as string) ?? '');
    supabase
      .from('profiles')
      .select('role')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role) setRole(data.role);
      });
  }, [user]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      await supabase
        .from('profiles')
        .upsert({ id: user!.id, full_name: fullName, preferred_language: language }, { onConflict: 'id' });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword.length < 6) {
      setPasswordError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    setSavingPassword(false);
    if (error) {
      setPasswordError(error);
      return;
    }
    setNewPassword('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2500);
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profile */}
        <form onSubmit={saveProfile} className="surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <User size={18} className="text-brand-400" />
            <h2 className="font-medium text-ink-100">{t('settings.profile')}</h2>
          </div>
          <div>
            <label className="label" htmlFor="sname">{t('settings.fullName')}</label>
            <input id="sname" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="semail">{t('settings.email')}</label>
            <input id="semail" value={user?.email ?? ''} disabled className="input opacity-60" />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {savingProfile ? t('settings.saving') : t('settings.save')}
            </button>
            {profileSaved && <span className="text-xs text-success-400">{t('settings.saved')}</span>}
          </div>
        </form>

        {/* Language */}
        <div className="surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-brand-400" />
            <h2 className="font-medium text-ink-100">{t('settings.language')}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                className={`p-3 rounded-lg border text-sm transition-colors ${
                  language === l.code
                    ? 'bg-brand-500/10 border-brand-500 text-brand-300'
                    : 'bg-ink-900 border-ink-700 text-ink-300 hover:border-ink-600'
                }`}
              >
                {l.nativeLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Security */}
        <form onSubmit={savePassword} className="surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-brand-400" />
            <h2 className="font-medium text-ink-100">{t('settings.security')}</h2>
          </div>
          <div>
            <label className="label" htmlFor="spass">{t('settings.newPassword')}</label>
            <input
              id="spass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2">
              {passwordError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={savingPassword || newPassword.length < 6} className="btn-primary">
              {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {t('settings.updatePassword')}
            </button>
            {passwordSaved && <span className="text-xs text-success-400">{t('settings.saved')}</span>}
          </div>
        </form>

        {/* Branding (admin only) */}
        <div className="surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-brand-400" />
            <h2 className="font-medium text-ink-100">{t('settings.branding')}</h2>
            <span className="badge badge-warning ms-auto">
              <ShieldAlert size={10} /> {t('settings.adminOnly')}
            </span>
          </div>

          {role !== 'admin' ? (
            <p className="text-sm text-ink-500">{t('settings.brandingNote')}</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <label className="label" htmlFor="bname">Product name</label>
                <input id="bname" defaultValue={branding.productName} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="burl">Company URL</label>
                <input id="burl" defaultValue={branding.companyUrl} className="input" />
              </div>
              <p className="text-xs text-ink-500">
                Logo and accent colors are defined centrally and apply studio-wide.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
