import { useEffect, useMemo, useRef } from 'react';
import { Chip, Club, Coin, Diamond, Heart, Spade } from './Icons';
import { useMotionOK } from '../lib/motion';

const SHAPES = [Spade, Heart, Diamond, Club] as const;

/**
 * Fixed background of slowly drifting suits, chips and coins on three depth
 * planes. Scrolling moves each plane at a different speed (parallax).
 */
export default function Ambient() {
  const ok = useMotionOK();
  const ref = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 16 }, (_, i) => {
      const plane = i % 3; // 0 far, 1 mid, 2 near
      return {
        i, plane,
        kind: i % 5 === 0 ? 'chip' : i % 7 === 0 ? 'coin' : 'suit',
        Shape: SHAPES[i % 4],
        left: r() * 100,
        size: [14, 22, 34][plane] + r() * 10,
        dur: [95, 70, 50][plane] + r() * 30,
        delay: -r() * 90,
        dx: (r() - 0.5) * 160,
        rot: (r() > 0.5 ? 1 : -1) * (180 + r() * 360),
        red: r() > 0.55,
      };
    });
  }, []);

  useEffect(() => {
    if (!ok) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ref.current?.style.setProperty('--scroll', String(window.scrollY)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [ok]);

  if (!ok) return null;
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {[0, 1, 2].map((plane) => (
        <div key={plane} className="absolute inset-0" style={{ transform: `translate3d(0, calc(var(--scroll, 0) * ${-[0.04, 0.1, 0.2][plane]}px), 0)` }}>
          {items.filter((it) => it.plane === plane).map((it) => (
            <div key={it.i} className="absolute top-0"
              style={{
                left: `${it.left}%`,
                animation: `drift-up ${it.dur}s linear ${it.delay}s infinite`,
                ['--dx' as string]: `${it.dx}px`, ['--rot' as string]: `${it.rot}deg`,
                opacity: [0.05, 0.08, 0.1][plane],
                willChange: 'transform',
              }}>
              {it.kind === 'chip' ? <div style={{ width: it.size, height: it.size }}><Chip color={it.red ? '#E63946' : '#F4C430'} className="block h-full w-full" /></div>
                : it.kind === 'coin' ? <Coin style={{ width: it.size, height: it.size }} />
                : <it.Shape style={{ width: it.size, height: it.size }} className={it.red ? 'text-blood' : 'text-cream'} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
