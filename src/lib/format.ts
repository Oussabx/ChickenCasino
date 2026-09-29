export const fmt = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtCoins = (n: number) => (Math.abs(n) >= 1e6 ? `${fmt(n / 1e6, 2)}M` : fmt(n, 2));

export const fmtCompact = (n: number) =>
  Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const fmtMult = (m: number) => `${m >= 100 ? fmt(m, 0) : fmt(m, 2)}×`;

export const timeAgo = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0');
