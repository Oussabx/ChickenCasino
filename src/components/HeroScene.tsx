import { ReactNode, useRef } from 'react';
import { layer, useMotionOK, useParallax } from '../lib/motion';
import { useLite } from '../lib/perf';
import { Card3D, Chip3D, Coin3D, EggGlow } from './Floaters';

/**
 * The home hero as a layered 3D scene. Every layer moves by its own depth as
 * the pointer (or phone tilt) and scroll position change, and the whole stage
 * tilts slightly in perspective.
 */
export default function HeroScene({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const ok = useMotionOK();
  const lite = useLite();
  const live = ok && !lite;
  useParallax(ref, live);
  // lite: flat layers — no per-layer compositing, no 3D stage
  const L = (depth: number, scroll = 0, extra = '') => (live ? layer(depth, scroll, extra) : undefined);

  return (
    <section ref={ref} className={`relative mt-4 lg:mt-6 overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-900 grain ${live ? '[perspective:1200px]' : ''}`}>
      {/* stage tilt */}
      <div className="absolute inset-0" style={live ? { transform: 'rotateY(calc(var(--mx, 0) * 2.5deg)) rotateX(calc(var(--my, 0) * -2deg))', transformStyle: 'preserve-3d' } : undefined}>
        {/* far: glow + bokeh */}
        <div className="absolute inset-[-10%]" style={L(-10, 40)}>
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_75%_40%,rgba(230,57,70,.32),transparent_60%)]" />
          {BOKEH.map((b, i) => (
            <span key={i} className="absolute rounded-full bob"
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s * 1.6, height: b.s * 1.6, marginLeft: -b.s * 0.3, marginTop: -b.s * 0.3, background: `radial-gradient(circle, ${b.c} 0%, ${b.c}80 25%, transparent 62%)`, opacity: 0.35, willChange: live ? 'transform' : undefined, ['--dur' as string]: `${7 + i}s`, ['--delay' as string]: `${-i * 1.3}s` }} />
          ))}
        </div>

        {/* mid: the rooster */}
        <div className="absolute right-[-4%] bottom-0 h-[70%] sm:h-[108%] sm:right-[-2%]" style={L(18, -30)}>
          <img src="./img/hero.webp" alt="Cool rooster in sunglasses with poker chips"
            className="h-full w-auto max-w-none object-cover [mask-image:linear-gradient(to_bottom,transparent,black_35%)] sm:[mask-image:linear-gradient(to_right,transparent,black_32%)] opacity-95" />
        </div>
        <div className="absolute inset-0 sm:hidden bg-gradient-to-b from-ink-900/40 via-ink-900/60 to-ink-900/90" />
        {/* keep the copy readable wherever the rooster ends up */}
        <div className="absolute inset-y-0 left-0 hidden sm:block w-[62%] bg-gradient-to-r from-ink-900 via-ink-900/85 to-transparent" />

        {/* near: floating 3D props */}
        {ok && (
          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            <div className="absolute right-[52%] top-[10%]" style={L(42, -60)}>
              <div className="bob" style={{ ['--dur' as string]: '6.5s', ['--r0' as string]: '-14deg', ['--r1' as string]: '-4deg' }}>
                <Card3D rank="A" suit="spade" className="h-[88px] w-[62px] text-[15px] [transform:rotateY(-25deg)_rotateX(10deg)]" />
              </div>
            </div>
            <div className="absolute right-[6%] top-[8%]" style={L(56, -90)}>
              <div className="bob" style={{ ['--dur' as string]: '7.5s', ['--delay' as string]: '-2s', ['--r0' as string]: '12deg', ['--r1' as string]: '22deg' }}>
                <Card3D rank="A" suit="heart" className="h-[104px] w-[74px] text-[17px] [transform:rotateY(30deg)_rotateX(-8deg)]" />
              </div>
            </div>
            <div className="absolute right-[34%] bottom-[14%]" style={L(64, -120)}>
              <div className="bob" style={{ ['--dur' as string]: '5.5s', ['--delay' as string]: '-1s' }}><Chip3D size={70} color="#E63946" tilt={58} /></div>
            </div>
            <div className="absolute right-[46%] bottom-[8%] blur-[1px]" style={L(30, -40)}>
              <div className="bob" style={{ ['--dur' as string]: '6s', ['--delay' as string]: '-3s' }}><Chip3D size={44} color="#1E1E1E" tilt={64} /></div>
            </div>
            <div className="absolute right-[50%] top-[40%]" style={L(74, -140)}>
              <div className="bob" style={{ ['--dur' as string]: '5s' }}><Coin3D size={46} dur={3.2} /></div>
            </div>
            <div className="absolute right-[58%] bottom-[18%] opacity-70" style={L(24, -20)}>
              <Coin3D size={30} dur={4.5} />
            </div>
            <div className="absolute right-[3%] bottom-[10%]" style={L(88, -160)}>
              <div className="bob" style={{ ['--dur' as string]: '6s', ['--delay' as string]: '-4s' }}><EggGlow size={48} /></div>
            </div>
            {/* out-of-focus foreground chip */}
            <div className="absolute right-[-2%] top-[46%] blur-[5px] opacity-80" style={L(130, -220)}>
              <Chip3D size={110} color="#F4C430" tilt={40} />
            </div>
          </div>
        )}
      </div>

      {/* content floats slightly against the scene */}
      <div className="relative z-10" style={ok ? layer(-8, 20) : undefined}>{children}</div>
    </section>
  );
}

const BOKEH = [
  { x: 70, y: 10, s: 140, c: '#E63946' },
  { x: 85, y: 55, s: 180, c: '#F4C430' },
  { x: 55, y: 70, s: 120, c: '#E63946' },
  { x: 92, y: 20, s: 90, c: '#FB923C' },
  { x: 40, y: 20, s: 110, c: '#8E1B24' },
];
