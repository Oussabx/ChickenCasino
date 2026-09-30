import { CSSProperties, ElementType, ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

/** False when the user turned on "Reduce motion" (in Settings or their OS). */
export function useMotionOK() {
  const reduce = useStore((s) => s.settings.reduceMotion);
  const [os, setOs] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setOs(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return !reduce && !os;
}

const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Drives CSS custom properties on `ref` for parallax:
 *  --mx / --my : smoothed pointer (or device tilt) position, -1..1
 *  --sy        : how far the element's centre is from the viewport centre, -1..1
 * Layers then use calc() with their own depth, so React never re-renders per frame.
 */
export function useParallax(ref: RefObject<HTMLElement>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, alive = true;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => { tx = 0; ty = 0; };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 25));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    };
    const tick = () => {
      if (!alive) return;
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      const r = el.getBoundingClientRect();
      const sy = Math.max(-1.5, Math.min(1.5, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
      el.style.setProperty('--mx', x.toFixed(4));
      el.style.setProperty('--my', y.toFixed(4));
      el.style.setProperty('--sy', sy.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    if (!finePointer()) window.addEventListener('deviceorientation', onTilt, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
      ['--mx', '--my', '--sy'].forEach((p) => el.style.removeProperty(p));
    };
  }, [ref, enabled]);
}

/** Style for a parallax layer: `depth` px of pointer travel, `scroll` px of scroll travel. */
export const layer = (depth: number, scroll = 0, extra = ''): CSSProperties => ({
  transform: `translate3d(calc(var(--mx, 0) * ${depth}px), calc(var(--my, 0) * ${depth}px + var(--sy, 0) * ${scroll}px), 0) ${extra}`,
  willChange: 'transform',
});

/** 3D tilt-on-hover wrapper with a moving glare highlight. */
export function Tilt({ children, className = '', max = 10, glare = true, scale = 1.02, as: Tag = 'div' }: { children: ReactNode; className?: string; max?: number; glare?: boolean; scale?: number; as?: ElementType }) {
  const ref = useRef<HTMLElement>(null);
  const ok = useMotionOK();
  useEffect(() => {
    const el = ref.current;
    if (!el || !ok || !finePointer()) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transition = 'transform .08s ease-out';
        el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) scale(${scale})`;
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
        el.style.setProperty('--go', '1');
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.transition = 'transform .6s cubic-bezier(.2,.9,.3,1.2)';
      el.style.transform = '';
      el.style.setProperty('--go', '0');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); };
  }, [ok, max, scale]);
  return (
    <Tag ref={ref} className={`relative [transform-style:preserve-3d] ${className}`}>
      {children}
      {glare && ok && (
        <span aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-300"
          style={{ opacity: 'var(--go, 0)', background: 'radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255,255,255,.18), transparent 55%)', mixBlendMode: 'overlay' }} />
      )}
    </Tag>
  );
}

/** Fades/slides children in the first time they scroll into view. */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div', variant = 'up' }: { children: ReactNode; className?: string; delay?: number; as?: ElementType; variant?: 'up' | 'zoom' | 'left' | 'right' }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const ok = useMotionOK();
  useEffect(() => {
    const el = ref.current;
    if (!el || !ok) return setShown(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [ok]);
  return (
    <Tag ref={ref} className={`reveal reveal-${variant} ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}>
      {children}
    </Tag>
  );
}

/** Tweens a number towards `value` (for balances and stats). */
export function useCountUp(value: number, ms = 600) {
  const ok = useMotionOK();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (!ok) { setShown(value); from.current = value; return; }
    const start = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = start + (value - start) * e;
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, ok]);
  return shown;
}
