/* ====== شعار سجل الرسمي — SVG مضمّن (يعمل في الطباعة وPDF) ====== */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} role="img" aria-label="شعار سجل">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.45" stopColor="#0f9d6e" />
          <stop offset="1" stopColor="#053622" />
        </linearGradient>
        <linearGradient id="lg-doc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef7f2" />
        </linearGradient>
        <linearGradient id="lg-fold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="lg-ln" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#059669" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#lg-bg)" />
      <circle cx="118" cy="104" r="150" fill="#ffffff" opacity="0.06" />
      <path d="M206 62 h146 l86 86 v252 q0 24 -24 24 h-208 q-24 0 -24 -24 V86 q0 -24 24 -24 Z" fill="url(#lg-doc)" />
      <path d="M352 62 l86 86 h-62 q-24 0 -24 -24 Z" fill="url(#lg-fold)" />
      <rect x="240" y="196" width="158" height="17" rx="8.5" fill="url(#lg-ln)" />
      <rect x="240" y="236" width="158" height="17" rx="8.5" fill="url(#lg-ln)" opacity="0.9" />
      <rect x="240" y="276" width="158" height="17" rx="8.5" fill="url(#lg-ln)" opacity="0.8" />
      <rect x="240" y="316" width="112" height="17" rx="8.5" fill="url(#lg-ln)" opacity="0.7" />
      <path d="M64 252 C 104 420 300 452 446 322" fill="none" stroke="#0b7a4f" strokeWidth="58" strokeLinecap="round" opacity="0.55" transform="translate(0 14)" />
      <path d="M64 252 C 104 420 300 452 446 322" fill="none" stroke="#ffffff" strokeWidth="52" strokeLinecap="round" />
      <path d="M300 430 C 356 402 404 356 436 300" fill="none" stroke="#a7f3d0" strokeWidth="20" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}
