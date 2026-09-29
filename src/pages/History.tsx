import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useStore } from '../store';
import { GAMES, GameId, gameById } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import { Coin } from '../components/Icons';
import GameArt from '../components/GameArt';

export default function History() {
  const rounds = useStore((s) => s.rounds);
  const [game, setGame] = useState<GameId | 'all'>('all');
  const [res, setRes] = useState<'all' | 'win' | 'loss'>('all');
  const [page, setPage] = useState(0);
  const PER = 20;

  const list = useMemo(() => rounds.filter((r) => (game === 'all' || r.game === game) && (res === 'all' || (res === 'win' ? r.payout > r.bet : r.payout <= r.bet))), [rounds, game, res]);
  const wagered = list.reduce((s, r) => s + r.bet, 0);
  const profit = list.reduce((s, r) => s + r.payout - r.bet, 0);
  const wins = list.filter((r) => r.payout > r.bet).length;
  const best = list.reduce((m, r) => Math.max(m, r.multiplier), 0);

  // cumulative profit sparkline (oldest → newest)
  const spark = useMemo(() => {
    const pts = [...list].reverse().slice(-150);
    let acc = 0;
    const ys = [0, ...pts.map((r) => (acc += r.payout - r.bet))];
    const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
    const d = ys.map((y, i) => `${(i / Math.max(1, ys.length - 1)) * 100},${40 - ((y - min) / span) * 36 - 2}`).join(' ');
    return { d, zero: 40 - ((0 - min) / span) * 36 - 2, up: acc >= 0 };
  }, [list]);

  const exportCsv = () => {
    const rows = [['time', 'game', 'bet', 'multiplier', 'payout', 'detail'], ...list.map((r) => [new Date(r.at).toISOString(), r.game, r.bet, r.multiplier, r.payout, r.detail ?? ''])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chicken-casino-history.csv'; a.click();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 space-y-6">
      <PageHeader kicker="History" title="Bet history" sub="Every round you've played, down to the last feather." img="mood-ace.webp" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Rounds', fmt(list.length, 0)],
          ['Wagered', fmt(wagered, 0)],
          ['Net profit', `${profit >= 0 ? '+' : ''}${fmt(profit)}`],
          ['Win rate', list.length ? `${((wins / list.length) * 100).toFixed(1)}%` : '—'],
          ['Best multi', best ? fmtMult(best) : '—'],
        ].map(([l, v], i) => (
          <div key={l} className="card p-4">
            <div className="label !text-[10px]">{l}</div>
            <div className={`mt-1 font-display text-xl font-black tabular ${i === 2 ? (profit >= 0 ? 'text-emerald-400' : 'text-blood') : i === 4 ? 'text-gold' : ''}`}>{v}</div>
          </div>
        ))}
      </div>

      {list.length > 1 && (
        <div className="card p-4">
          <div className="label mb-2">Profit over time</div>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-28 w-full">
            <line x1="0" x2="100" y1={spark.zero} y2={spark.zero} stroke="rgba(255,255,255,.12)" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
            <polyline points={spark.d} fill="none" stroke={spark.up ? '#34d399' : '#E63946'} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <select className="input sm:w-56" value={game} onChange={(e) => { setGame(e.target.value as GameId | 'all'); setPage(0); }} aria-label="Filter by game">
          <option value="all">All games</option>
          {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <div className="seg sm:w-64">
          {(['all', 'win', 'loss'] as const).map((r) => <button key={r} data-active={res === r} onClick={() => { setRes(r); setPage(0); }}>{r === 'all' ? 'All' : r === 'win' ? 'Wins' : 'Losses'}</button>)}
        </div>
        <button className="btn-ghost px-4 py-2.5 text-sm sm:ml-auto" onClick={exportCsv} disabled={!list.length}><Download size={15} />Export CSV</button>
      </div>

      <div className="card overflow-hidden">
        {/* desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-ink-700/60 text-left text-[11px] uppercase tracking-wider text-smoke">
            <tr><th className="px-4 py-3">Game</th><th>Time</th><th>Details</th><th>Bet</th><th>Multi</th><th className="text-right px-4">Profit</th></tr>
          </thead>
          <tbody className="tabular">
            {list.slice(page * PER, page * PER + PER).map((r) => (
              <tr key={r.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3"><div className="flex items-center gap-2.5"><GameArt id={r.game} className="h-8 w-8 rounded-lg" /><span className="font-semibold">{gameById(r.game)?.name}</span></div></td>
                <td className="text-smoke">{new Date(r.at).toLocaleString()}</td>
                <td className="text-smoke max-w-[220px] truncate">{r.detail}</td>
                <td><span className="inline-flex items-center gap-1"><Coin className="h-3.5 w-3.5" />{fmt(r.bet)}</span></td>
                <td className={r.multiplier >= 1 ? 'text-emerald-400 font-semibold' : 'text-smoke'}>{fmtMult(r.multiplier)}</td>
                <td className={`text-right px-4 font-display font-bold ${r.payout > r.bet ? 'text-emerald-400' : r.payout < r.bet ? 'text-blood' : ''}`}>{r.payout > r.bet ? '+' : ''}{fmt(r.payout - r.bet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* mobile list */}
        <ul className="md:hidden divide-y divide-white/[0.05]">
          {list.slice(page * PER, page * PER + PER).map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <GameArt id={r.game} className="h-11 w-11 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{gameById(r.game)?.name}</div>
                <div className="text-[11px] text-smoke truncate">{new Date(r.at).toLocaleTimeString()} · {r.detail}</div>
              </div>
              <div className="text-right tabular">
                <div className={`font-display font-bold text-sm ${r.payout > r.bet ? 'text-emerald-400' : r.payout < r.bet ? 'text-blood' : ''}`}>{r.payout > r.bet ? '+' : ''}{fmt(r.payout - r.bet)}</div>
                <div className="text-[11px] text-smoke">{fmt(r.bet)} @ {fmtMult(r.multiplier)}</div>
              </div>
            </li>
          ))}
        </ul>
        {!list.length && <div className="py-16 text-center text-smoke">Nothing here yet. Go lay some eggs! 🥚</div>}
        {list.length > PER && (
          <div className="flex items-center justify-between border-t border-white/5 p-3 text-sm">
            <button className="btn-dark px-3 py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="text-smoke">Page {page + 1} of {Math.ceil(list.length / PER)}</span>
            <button className="btn-dark px-3 py-1.5" disabled={(page + 1) * PER >= list.length} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
