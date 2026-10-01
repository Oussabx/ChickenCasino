import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Gift, Plus, Receipt, ShoppingBag, Wallet as WalletIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useStore, useUI } from '../store';
import { fmt, timeAgo } from '../lib/format';
import { usd } from '../lib/payment';
import { ProductKind } from '../lib/coinStore';
import { Coin, Egg } from '../components/Icons';
import CoinStore from '../components/store/CoinStore';
import PaymentMethods from '../components/store/PaymentMethods';

export default function Wallet() {
  const { balance, eggs, txs, user, stats, orders } = useStore();
  const openAuth = useUI((s) => s.openAuth);
  const openStore = useUI((s) => s.openStore);
  const profit = stats.won - stats.wagered;
  const [tab, setTab] = useState<ProductKind>('coins');
  const [params] = useSearchParams();
  // /wallet?section=cards (from the account menu) jumps to the saved cards
  useEffect(() => {
    const s = params.get('section');
    if (!s) return;
    const t = setTimeout(() => document.getElementById(s === 'cards' ? 'payment-methods' : 'buy')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [params]);
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 pt-6 space-y-6">
      <PageHeader kicker="Wallet" title="Your stash" sub="Top up coins and golden eggs, manage your cards, and see every transaction. Virtual coins have no cash value." img="strip-chips.webp" />
      {!user && (
        <div className="card p-6 text-center">
          <p className="text-smoke">Create an account to get your wallet and a 10,000 coin welcome bonus.</p>
          <button className="btn-gold mt-4 px-6 py-3" onClick={() => openAuth('signup')}>Sign up</button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 sm:col-span-2 relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -bottom-8 opacity-10" aria-hidden="true"><Coin className="h-48 w-48" /></div>
          <div className="label">Coin balance</div>
          <div className="mt-1 flex items-center gap-2 h-display text-4xl sm:text-5xl tabular"><Coin className="h-9 w-9" />{fmt(balance)}</div>
          <div className={`mt-2 text-sm font-semibold ${profit >= 0 ? 'text-emerald-400' : 'text-blood'}`}>{profit >= 0 ? '+' : ''}{fmt(profit)} all-time game P/L</div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => openStore({ tab: 'coins' })} className="btn-gold px-4 py-2.5 text-sm"><Plus size={16} />Buy coins</button>
            <Link to="/promotions" className="btn-ghost px-4 py-2.5 text-sm"><Gift size={16} />Free coins</Link>
            <Link to="/shop" className="btn-ghost px-4 py-2.5 text-sm"><ShoppingBag size={16} />Shop</Link>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-15" aria-hidden="true"><Egg className="h-36 w-36" /></div>
          <div className="label">Golden eggs</div>
          <div className="mt-1 flex items-center gap-2 h-display text-4xl tabular"><Egg className="h-8 w-8" />{eggs}</div>
          <p className="mt-2 text-xs text-smoke">Premium currency. Earned from level-ups, streaks & missions — or buy a pack.</p>
          <button type="button" onClick={() => openStore({ tab: 'eggs' })} className="btn-ghost relative mt-4 px-4 py-2.5 text-sm"><Plus size={16} />Buy eggs</button>
        </div>
      </div>

      <section id="buy" className="card scroll-mt-24 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-extrabold"><ShoppingBag size={18} className="text-gold" />Top up</h2>
        <p className="mb-4 text-sm text-smoke">Coin packs, golden eggs and skin bundles. Bigger packs come with bonus coins.</p>
        <CoinStore tab={tab} setTab={setTab} onBuy={(p) => openStore({ tab: p.kind, product: p.id })} />
      </section>

      {user && <PaymentMethods />}

      {user && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><Receipt size={18} className="text-gold" />Purchase history</h2>
          {orders.length ? (
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><Receipt size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{o.name}</div>
                    <div className="truncate text-[11px] text-smoke">{o.card} · {timeAgo(o.at)} · demo</div>
                  </div>
                  <div className="font-display text-sm font-bold tabular">{usd(o.usd)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 py-4 text-center text-sm text-smoke">No purchases yet.</p>}
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-display text-lg font-extrabold flex items-center gap-2"><WalletIcon size={18} className="text-gold" />Transactions</h2>
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {txs.length ? txs.slice(0, 50).map((t) => {
            const pos = t.coins > 0 || t.eggs > 0;
            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className={`grid h-9 w-9 place-items-center rounded-xl ${pos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blood/10 text-blood'}`}>{pos ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.label}</div>
                  <div className="text-[11px] text-smoke capitalize">{t.kind} · {timeAgo(t.at)}</div>
                </div>
                <div className="text-right text-sm font-display font-bold tabular">
                  {t.coins !== 0 && <div className={`flex items-center justify-end gap-1 ${t.coins > 0 ? 'text-emerald-400' : 'text-blood'}`}>{t.coins > 0 ? '+' : ''}{fmt(t.coins)}<Coin className="h-3.5 w-3.5" /></div>}
                  {t.eggs !== 0 && <div className={`flex items-center justify-end gap-1 ${t.eggs > 0 ? 'text-gold' : 'text-blood'}`}>{t.eggs > 0 ? '+' : ''}{t.eggs}<Egg className="h-3.5 w-3.5" /></div>}
                </div>
              </li>
            );
          }) : <li className="py-8 text-center text-smoke text-sm">No transactions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
