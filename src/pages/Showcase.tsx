import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Bare, full-screen 3D scene posed for a screenshot. Used to render the game
 * card thumbnails (see scripts/render-thumbs.mjs); not linked from the UI.
 */
export default function Showcase() {
  const { id } = useParams();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dispose = () => {};
    let alive = true;
    const el = host.current!;
    const ready = () => { if (alive) el.dataset.ready = '1'; };
    (async () => {
      switch (id) {
        case 'plinko': {
          const { PlinkoScene } = await import('../games/three/plinko3d');
          const s = new PlinkoScene(el); dispose = () => s.dispose();
          s.setBoard(12, [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33]);
          s.setView([0, -7, 0], 12, 9.5, [0.5, 0.35, 1], 1);
          const paths = [[0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1], [1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0], [0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1], [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0]];
          paths.forEach((p, i) => setTimeout(() => s.drop(i, p, { onPeg: () => {}, onLand: () => {} }), i * 230));
          setTimeout(ready, 1150);
          break;
        }
        case 'crash': {
          const { CrashScene } = await import('../games/three/crash3d');
          const s = new CrashScene(el); dispose = () => s.dispose();
          s.setState('running', 1.01);
          s.setView([2.5, 1.2, 0], 12, 9, [-0.35, 0.1, 1], 1);
          let m = 1.01;
          const grow = () => { m = Math.min(4.2, m * 1.04); s.setState('running', m); if (m < 4.2) requestAnimationFrame(grow); else setTimeout(ready, 400); };
          requestAnimationFrame(grow);
          break;
        }
        case 'egg-hunt': {
          const { EggHuntScene } = await import('../games/three/egghunt3d');
          const s = new EggHuntScene(el); dispose = () => s.dispose();
          [6, 8, 12, 16, 18].forEach((i, k) => setTimeout(() => s.reveal(i, 'egg'), 100 + k * 120));
          setTimeout(() => s.reveal(13, 'fox'), 800);
          setTimeout(ready, 2000);
          break;
        }
        case 'cluck-dice': {
          const { DiceScene } = await import('../games/three/dice3d');
          const s = new DiceScene(el); dispose = () => s.dispose();
          s.setTarget(50.5, true);
          s.setView([1, 0.4, -0.5], 14, 8, [0.35, 1.1, 1.3], 1);
          s.roll(72.41, true, 900).then(() => setTimeout(ready, 250));
          break;
        }
        case 'golden-wheel': {
          const { WheelScene } = await import('../games/three/wheel3d');
          const s = new WheelScene(el); dispose = () => s.dispose();
          s.setSegments([0, 1.5, 0, 2, 0, 1.5, 3, 0, 1.6, 0, 1.5, 0, 2, 0, 1.5, 0, 2, 0, 1.6, 0, 1.5, 3, 0, 2, 0, 1.5, 0, 2, 0, 1.5]);
          s.spin(30, 300, () => {}).then(() => { s.highlight(1); setTimeout(ready, 600); });
          break;
        }
        case 'chicken-cross': {
          const { CrossScene } = await import('../games/cross3d');
          const s = new CrossScene(el); dispose = () => s.dispose();
          s.build(Array.from({ length: 22 }, (_, i) => Math.floor((0.99 / Math.pow(0.88, i + 1)) * 100) / 100));
          await s.hop(1, true); await s.hop(2, true); await s.hop(3, true);
          setTimeout(ready, 1400);
          break;
        }
      }
    })();
    return () => { alive = false; dispose(); };
  }, [id]);

  return <div ref={host} id="showcase" className="fixed inset-0 z-[200] bg-ink" />;
}
