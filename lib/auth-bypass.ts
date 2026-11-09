/**
 * Dev-only login bypass: with NEXT_PUBLIC_BYPASS_AUTH=true every visitor is the
 * fixed "dev_user". Never honoured in production builds (next build / Vercel),
 * so a stray env var can't expose real data to anonymous visitors.
 */
export const AUTH_BYPASS =
  process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production'
