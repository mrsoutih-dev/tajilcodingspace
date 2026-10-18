import { branding } from '@/config/branding';

export function Logo({ size = 32, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#0f172a" />
        <path
          d="M9 11.5L16 8l7 3.5v9L16 24l-7-3.5v-9z"
          stroke="#14b8a6"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="16" r="2.5" fill="#2dd4bf" />
      </svg>
      {withWordmark && (
        <span className="font-semibold text-ink-100 text-[15px] tracking-tight leading-none">
          {branding.shortName}
          <span className="text-brand-400">.</span>
        </span>
      )}
    </span>
  );
}
