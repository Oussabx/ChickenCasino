import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Clock, Medal } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { Round, toast, useStore, useUI } from '../store';
import { BOT_NAMES, GameId, gameById } from '../lib/data';
import { useCountdown } from '../lib/useLiveFeed';
import { fmt, pad2 } from '../lib/format';
import GameArt from '../components/GameArt';
import Avatar from '../components/Avatar';
import { Coin } from '../components/Icons';
import { Reveal, Tilt } from '../lib/motion';

const weekStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime(); };
const WEEK_END = weekStart() + 7 * 864e5;
const DAY_END = (() => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return d.getTime(); })();

interface T { id: string; name: string; game: GameId | null; pool: number; metric: 'mult' | 'wagered' | 'profit'; ends: number; desc: string; prizes: number[] }
const TOURNAMENTS: T[] = [
  { id: 'showdown', name: 'Chicken Showdown', game: null, pool: 250000, metric: 'wagered', ends: WEEK_END, desc: 'Most coins wagered across all games this week.', prizes: [40, 25, 15, 8, 5, 3, 2, 1, 0.5, 0.5] },
  { id: 'crossing', name: 'Crossing Cup', game: 'chicken-cross', pool: 100000, metric: 'mult', ends: WEEK_END, desc: 'Highest single multiplier in Chicken Cross.', prizes: [40, 25, 15, 8, 5, 3, 2, 1, 0.5, 0.5] },
  { id: 'rooster-daily', name: 'Rooster Daily Sprint', game: 'crash', pool: 25000, metric: 'profit', ends: DAY_END, desc: 'Biggest total profit in Rocket Rooster today.', prizes: [50, 25, 12, 6, 4, 2, 1] },
];

const score = (t: T, rounds: Round[]) => {
  const since = t.ends === DAY_END ? DAY_END - 864e5 : weekStart();
  const r = rounds.filter((x) => x.at >= since && (!t.game || x.game === t.game));
  if (t.metric === 'mult') return r.reduce((m, x) => Math.max(m, x.multiplier), 0);
  if (t.metric === 'wagered') return r.reduce((s, x) => s + x.bet, 0);
  return r.reduce((s, x) => s + x.payout - x.bet, 0);
};

function bots(t: T) {
  let seed = [...t.id].reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(Date.now() / 36e5); // drifts hourly
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return BOT_NAMES.slice(0, 14).map((name) => ({
    name,
    score: t.metric === 'mult' ? +(2 + Math.pow(r(), 3) * 400).toFixed(2) : t.metric === 'wagered' ? Math.round(2000 + Math.pow(r(), 2) * 180000) : Math.round(Math.pow(r(), 2) * 20000),
  }));
}

const fmtScore = (t: T, v: number) => (t.metric === 'mult' ? `${fmt(v)}×` : fmt(v, 0));

export default function Tournaments() {
  const [sel, setSel] = useState(TOURNAMENTS[0].id);
  const t = TOURNAMENTS.find((x) => x.id === sel)!;
  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 space-y-6">
      <PageHeader kicker="Compete" title="Tournaments" sub="Climb the leaderboard, split the prize pool. Scores update as you play." img="mood-crown.webp" />
      <div className="grid gap-4 md:grid-cols-3">
        {TOURNAMENTS.map((x, i) => <Reveal key={x.id} delay={i * 110}><TCard t={x} active={sel === x.id} onClick={() => setSel(x.id)} /></Reveal>)}
      </div>
      <Leaderboard t={t} />
    </div>
  );
}

function TCard({ t, active, onClick }: { t: T; active: boolean; onClick: () => void }) {
  const cd = useCountdown(t.ends);
  const joined = useStore((s) => s.tournaments.includes(t.id));
  return (
    <Tilt className="rounded-2xl h-full"><button onClick={onClick} className={`card w-full h-full text-left overflow-hidden transition ${active ? 'ring-2 ring-gold shadow-gold' : 'hover:border-gold/30'}`}>
      <div className="relative h-28">
        {t.game ? <GameArt id={t.game} className="absolute inset-0" /> : <img src="./img/mood-chips.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-800 to-transparent" />
        {joined && <span className="chip absolute right-3 top-3 bg-emerald-500 text-ink">Joined</span>}
      </div>
      <div className="p-4 pt-0 -mt-4 relative">
        <div className="flex items-center gap-2"><Trophy size={16} className="text-gold" /><span className="font-display font-extrabold">{t.name}</span></div>
        <div className="mt-1 flex items-center gap-1 text-sm font-bold text-gold"><Coin className="h-4 w-4" />{fmt(t.pool, 0)} pool</div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-smoke"><Clock size={12} />Ends in <span className="font-bold text-cream tabular">{cd.days ? `${cd.days}d ` : ''}{pad2(cd.hours)}:{pad2(cd.mins)}:{pad2(cd.secs)}</span></div>
      </div>
    </button></Tilt>
  );
}

function Leaderboard({ t }: { t: T }) {
  const user = useStore((s) => s.user);
  const rounds = useStore((s) => s.rounds);
  const joined = useStore((s) => s.tournaments.includes(t.id));
  const join = useStore((s) => s.joinTournament);
  const openAuth = useUI((s) => s.openAuth);
  const my = score(t, rounds);
  const rows = useMemo(() => {
    const list = bots(t).map((b) => ({ ...b, you: false }));
    if (joined && user) list.push({ name: user.name, score: my, you: true });
    return list.sort((a, b) => b.score - a.score);
  }, [t, joined, user, my]);
  const myRank = rows.findIndex((r) => r.you) + 1;
  const prizeFor = (i: number) => (t.prizes[i] ? (t.pool * t.prizes[i]) / 100 : 0);

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t.name}</h2>
          <p className="text-sm text-smoke">{t.desc}</p>
        </div>
        <div className="flex gap-2">
          {joined ? (
            <Link to={t.game ? `/games/${t.game}` : '/games'} className="btn-gold px-5 py-2.5">Play to climb</Link>
          ) : (
            <button className="btn-gold px-5 py-2.5" onClick={() => { if (!user) return openAuth('signup'); join(t.id); toast({ title: `You joined ${t.name}!`, tone: 'gold' }); }}>Join tournament — free</button>
          )}
        </div>
      </div>

      {joined && (
        <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 flex items-center gap-4">
          <Avatar size={44} />
          <div className="flex-1"><div className="label">Your position</div><div className="font-display text-2xl font-black">#{myRank} <span className="text-sm text-smoke font-semibold">of {rows.length}</span></div></div>
          <div className="text-right"><div className="label">Score</div><div className="font-display text-xl font-black text-gold tabular">{fmtScore(t, my)}</div></div>
        </div>
      )}

      {/* podium */}
      <div className="mt-6 grid grid-cols-3 gap-3 items-end max-w-xl mx-auto">
        {[1, 0, 2].map((i) => rows[i] && (
          <div key={i} className="text-center">
            <div className={`mx-auto grid place-items-center rounded-full font-display font-black ${i === 0 ? 'h-16 w-16 bg-gold text-ink text-xl shadow-gold' : i === 1 ? 'h-12 w-12 bg-zinc-300 text-ink' : 'h-12 w-12 bg-amber-700 text-cream'}`}>{rows[i].name[0]}</div>
            <div className={`mt-2 text-sm font-semibold truncate ${rows[i].you ? 'text-gold' : ''}`}>{rows[i].name}</div>
            <div className={`mt-2 rounded-t-xl ${i === 0 ? 'h-24 bg-gradient-to-b from-gold/40' : i === 1 ? 'h-16 bg-gradient-to-b from-zinc-300/30' : 'h-12 bg-gradient-to-b from-amber-700/40'} to-transparent grid place-items-start pt-2 justify-center`}>
              <Medal size={18} className={i === 0 ? 'text-gold' : 'text-cream/70'} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-smoke">
            <tr><th className="py-2 w-12">#</th><th>Player</th><th className="text-right">Score</th><th className="text-right">Prize</th></tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r, i) => (
              <tr key={r.name + i} className={`border-t border-white/[0.04] ${r.you ? 'bg-gold/10' : ''}`}>
                <td className="py-2.5 font-display font-black text-smoke">{i + 1}</td>
                <td className={`font-semibold ${r.you ? 'text-gold' : ''}`}>{r.name}{r.you && ' (you)'}</td>
                <td className="text-right">{fmtScore(t, r.score)}</td>
                <td className="text-right">{prizeFor(i) ? <span className="inline-flex items-center gap-1 font-bold text-gold"><Coin className="h-3.5 w-3.5" />{fmt(prizeFor(i), 0)}</span> : <span className="text-smoke">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-smoke"><Users size={12} />Standings refresh as you play. Game: {t.game ? gameById(t.game)?.name : 'All games'}.</p>
    </section>
  );
}
