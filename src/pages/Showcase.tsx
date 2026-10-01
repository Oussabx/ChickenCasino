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
        case 'poker': {
          const { TableScene } = await import('../games/three/table3d');
          const s = new TableScene(el, { felt: 0x0f4d33, oval: { portrait: false }, logoZ: null }); dispose = () => s.dispose();
          s.setTurbo(true);
          const C = (r: number, suit: 'S' | 'H' | 'D' | 'C') => ({ r, s: suit });
          s.setView([0, 0, 0.3], 11.5, 7.6, [0, 1.6, 1], 1);
          for (const [i, c] of [C(14, 'H'), C(13, 'H'), C(12, 'H'), C(7, 'C'), C(2, 'S')].entries()) await s.deal(c, -2.3 + i * 1.15, 0.05, { scale: 1.05 });
          await s.deal(C(11, 'H'), -0.6, 2.25, { scale: 1.12 }); await s.deal(C(10, 'H'), 0.6, 2.25, { scale: 1.12 });
          for (const f of [0.2, 0.35, 0.65, 0.8]) {
            const e = s.edge(f); const p = e.p.clone().addScaledVector(e.n, -1.45); const rot = Math.atan2(e.n.x, e.n.z) * 0.9;
            await s.deal(null, p.x - 0.2, p.z, { scale: 0.72, rot }); await s.deal(null, p.x + 0.2, p.z, { scale: 0.72, rot });
            const b = e.p.clone().addScaledVector(e.n, -2.45); s.setChips(`b${f}`, 50, b.x, b.z);
          }
          s.setChips('pot', 400, 0, -1.45);
          s.moveButton(1.4, 2.3);
          s.highlight(0, 1.2, 6.3, 3.9);
          setTimeout(ready, 900);
          break;
        }
        case 'blackjack': case 'baccarat': case 'punto-banco': case 'video-poker': {
          const { TableScene } = await import('../games/three/table3d');
          const cfg = id === 'blackjack' ? (await import('../games/Blackjack')).TABLE
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
        case 'slots': {
          const { SlotsScene } = await import('../games/three/slots3d');
          const { evaluate } = await import('../lib/slots');
          const s = new SlotsScene(el); dispose = () => s.dispose();
          s.setView([0.2, 0.35, 0], 11.4, 9.2, [0, 0.04, 1], 1);
          const res = evaluate([29, 23, 10, 7, 35]);
          await new Promise((r) => setTimeout(r, 600));
          await s.spin(res.stops, { turbo: true });
          s.showWins(res.lines.map((l) => l.line), res.lines.flatMap((l) => l.cells));
          setTimeout(ready, 900);
          break;
        }
        case 'craps': {
          const { CrapsScene } = await import('../games/three/craps3d');
          const s = new CrapsScene(el); dispose = () => s.dispose();
          s.setView([-0.6, 0, 0.2], 9.6, 8.2, [0, 1.7, 1], 1);
          s.setBets({ pass: 100, passOdds: 250, field: 25, place6: 30, hard8: 10, 'come:9': 50 });
          s.setPoint(6);
          await s.throwDice(5, 6, 900);
          setTimeout(ready, 700);
          break;
        }
        case 'keno': {
          const { KenoScene } = await import('../games/three/keno3d');
          const s = new KenoScene(el); dispose = () => s.dispose();
          s.setView([0.1, 1.0, 0.7], 5.2, 4.2, [0.2, 0.5, 1], 1);
          const nums = [7, 23, 41, 12, 66, 3, 58, 79, 33, 18, 50, 71, 9, 27];
          nums.forEach((n, i) => setTimeout(() => s.lay(n, [7, 41, 66, 33].includes(n), 300), i * 110));
          setTimeout(ready, nums.length * 110 + 900);
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
