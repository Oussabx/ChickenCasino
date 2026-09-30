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
        case 'blackjack': case 'baccarat': case 'punto-banco': case 'poker': case 'video-poker': {
          const { TableScene } = await import('../games/three/table3d');
          const cfg = id === 'blackjack' ? (await import('../games/Blackjack')).TABLE
            : id === 'poker' ? (await import('../games/Poker')).TABLE
            : id === 'video-poker' ? (await import('../games/VideoPoker')).TABLE
            : (await import('../games/Baccarat')).tableFor(id === 'punto-banco');
          const s = new TableScene(el, cfg); dispose = () => s.dispose();
          s.setTurbo(true);
          const C = (r: number, suit: 'S' | 'H' | 'D' | 'C') => ({ r, s: suit });
          s.setView([0, 0, -0.35], 7.4, 5.2, [0, 1.3, 1], 1);
          if (id === 'blackjack') {
            s.setChips('bet', 125, 0, 2.35);
            await s.deal(C(14, 'S'), -0.3, 1.05); await s.deal(C(9, 'D'), -0.62, -1.85); await s.deal(C(13, 'H'), 0.22, 0.97); await s.deal(null, 0, -1.85);
            s.highlight(-0.04, 1.01, 1.62, 1.6);
          } else if (id === 'baccarat' || id === 'punto-banco') {
            s.setChips('b', 100, 2.45, 1.4); s.setChips('p', 25, -2.45, 1.4);
            await s.deal(C(9, 'H'), -2.5, -1.05); await s.deal(C(8, 'C'), 1.4, -1.05); await s.deal(C(12, 'S'), -1.4, -1.05); await s.deal(C(id === 'baccarat' ? 13 : 8, 'D'), 2.5, -1.05);
            s.highlight(-1.95, -1.05, 2.5, 1.85);
          } else if (id === 'poker') {
            s.setChips('ante', 50, -2.15, 1.45); s.setChips('call', 100, 2.15, 1.45);
            for (const [i, c] of [C(14, 'H'), C(13, 'H'), C(12, 'H'), C(7, 'C'), C(2, 'S')].entries()) await s.deal(c, -2.3 + i * 1.15, -0.45);
            await s.deal(C(11, 'H'), -0.56, 1.15); await s.deal(C(10, 'H'), 0.56, 1.15);
            await s.deal(null, -0.56, -2.1); await s.deal(null, 0.56, -2.1);
            s.highlight(0, 1.15, 2.4, 1.8);
          } else {
            s.setChips('bet', 100, 0, 1.55);
            for (const [i, c] of [C(10, 'S'), C(11, 'S'), C(12, 'S'), C(13, 'S'), C(14, 'S')].entries()) await s.deal(c, -2.4 + i * 1.2, -0.15);
            s.highlight(0, -0.15, 6.1, 1.8);
          }
          setTimeout(ready, 900);
          break;
        }
        case 'roulette': {
          const { RouletteScene } = await import('../games/three/roulette3d');
          const s = new RouletteScene(el); dispose = () => s.dispose();
          s.setView([0, 0.2, 0.3], 8.6, 8.6, [0.25, 1.35, 1], 1);
          s.spin(17, 900, () => {}).then(() => setTimeout(ready, 400));
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
