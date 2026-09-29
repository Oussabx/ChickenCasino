import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toast, useLevel, useStore } from '../store';
import { ItemKind, RARITY_STYLE, SHOP, ShopItem } from '../lib/data';
import { fmt } from '../lib/format';
import { ChickenSprite, Coin, Egg } from '../components/Icons';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import { sfx } from '../lib/sound';

const TABS: { k: ItemKind; label: string }[] = [
  { k: 'bundle', label: 'Coin bundles' },
  { k: 'avatar', label: 'Avatars' },
  { k: 'frame', label: 'Frames' },
  { k: 'skin', label: 'Chicken skins' },
  { k: 'ball', label: 'Plinko eggs' },
  { k: 'title', label: 'Titles' },
];

export default function Shop() {
  const [tab, setTab] = useState<ItemKind>('bundle');
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  const eggs = useStore((s) => s.eggs);
  const balance = useStore((s) => s.balance);
  const items = SHOP.filter((i) => i.kind === tab);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 space-y-6">
      <PageHeader kicker="The Coop Store" title={<>Shop <span className="text-gold-grad">& flex</span></>} sub="Spend coins and golden eggs on cosmetics that show up in your games and profile."
        img="strip-chips.webp"
        right={
          <div className="flex gap-2">
            <div className="rounded-2xl bg-ink/70 border border-white/10 px-4 py-2.5 backdrop-blur"><div className="label !text-[10px]">Coins</div><div className="flex items-center gap-1.5 font-display font-black tabular"><Coin className="h-4 w-4" />{fmt(balance)}</div></div>
            <div className="rounded-2xl bg-ink/70 border border-gold/30 px-4 py-2.5 backdrop-blur"><div className="label !text-[10px]">Golden eggs</div><div className="flex items-center gap-1.5 font-display font-black tabular"><Egg className="h-4 w-4" />{eggs}</div></div>
          </div>
        } />

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition ${tab === t.k ? 'bg-gold text-ink border-gold' : 'border-white/10 text-cream/80 hover:border-white/30'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'bundle' && <p className="text-sm text-smoke -mt-2">Golden eggs are earned from level-ups, daily streaks, missions and promo codes — trade them here for coins.</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((it) => <Item key={it.id} it={it} onBuy={() => setConfirm(it)} />)}
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Confirm purchase">
        {confirm && (
          <div>
            <div className="rounded-2xl bg-ink-900 p-5 flex items-center gap-4">
              <Preview it={confirm} small />
              <div>
                <div className="font-display font-bold text-lg">{confirm.name}</div>
                <div className={`text-xs font-bold uppercase ${RARITY_STYLE[confirm.rarity].split(' ')[0]}`}>{confirm.rarity}</div>
                <div className="mt-1 flex items-center gap-1 font-display font-black">{confirm.currency === 'coins' ? <Coin className="h-4 w-4" /> : <Egg className="h-4 w-4" />}{fmt(confirm.price, 0)}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn-ghost py-3" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-gold py-3" onClick={() => {
                const err = useStore.getState().buy(confirm.id);
                if (err) { toast({ title: err, tone: 'red' }); }
                else {
                  sfx.cashout();
                  if (confirm.kind !== 'bundle') useStore.getState().equip(confirm.id);
                  toast({ title: confirm.kind === 'bundle' ? `+${fmt(confirm.coins!, 0)} coins` : `${confirm.name} unlocked & equipped!`, tone: 'gold' });
                }
                setConfirm(null);
              }}>Buy now</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Item({ it, onBuy }: { it: ShopItem; onBuy: () => void }) {
  const owned = useStore((s) => s.inventory.includes(it.id));
  const equippedMap = useStore((s) => s.equipped);
  const equip = useStore((s) => s.equip);
  const { level } = useLevel();
  const equipped = Object.values(equippedMap).includes(it.id);
  const locked = !!it.minLevel && level < it.minLevel;
  const isBundle = it.kind === 'bundle';
  return (
    <div className={`card overflow-hidden border ${RARITY_STYLE[it.rarity].split(' ')[1]} flex flex-col`}>
      <div className={`relative aspect-square grid place-items-center overflow-hidden ${it.rarity === 'legendary' ? 'bg-[radial-gradient(circle,rgba(244,196,48,.18),transparent_70%)]' : 'bg-[radial-gradient(circle,rgba(255,255,255,.05),transparent_70%)]'}`}>
        <Preview it={it} />
        <span className={`chip absolute left-2 top-2 bg-ink/80 uppercase !text-[10px] ${RARITY_STYLE[it.rarity].split(' ')[0]}`}>{it.rarity}</span>
        {equipped && <span className="chip absolute right-2 top-2 bg-gold text-ink !text-[10px]"><Check size={10} />EQUIPPED</span>}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="font-display font-bold leading-tight">{it.name}</div>
        <div className="text-xs text-smoke mt-0.5 flex-1">{it.desc}</div>
        <div className="mt-3">
          {owned && !isBundle ? (
            <button className={`w-full py-2 text-sm ${equipped ? 'btn-dark' : 'btn-ghost'}`} disabled={equipped} onClick={() => { equip(it.id); sfx.click(); }}>{equipped ? 'Equipped' : 'Equip'}</button>
          ) : locked ? (
            <button className="btn-dark w-full py-2 text-sm" disabled><Lock size={12} />Level {it.minLevel}</button>
          ) : (
            <button className="btn-gold w-full py-2 text-sm" onClick={onBuy}>
              {it.price === 0 ? 'Free' : <>{it.currency === 'coins' ? <Coin className="h-4 w-4" /> : <Egg className="h-4 w-4" />}{fmt(it.price, 0)}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Preview({ it, small }: { it: ShopItem; small?: boolean }) {
  const sz = small ? 'h-16 w-16' : 'h-3/5 w-3/5';
  switch (it.kind) {
    case 'bundle':
      return (
        <div className={`relative ${small ? 'h-16 w-16' : 'h-1/2 w-1/2'}`}>
          {Array.from({ length: Math.min(6, 2 + SHOP.filter((s) => s.kind === 'bundle').indexOf(it) * 2) }).map((_, i) => (
            <Coin key={i} className="absolute h-1/2 w-1/2" style={{ left: `${(i % 3) * 25}%`, top: `${40 - Math.floor(i / 3) * 30 + (i % 2) * 6}%` }} />
          ))}
          {!small && <div className="absolute -bottom-6 inset-x-0 text-center font-display font-black text-gold text-sm">{fmt(it.coins!, 0)}</div>}
        </div>
      );
    case 'avatar':
      return <img src={`./img/${it.img}`} alt="" className={`${sz} rounded-full object-cover ring-2 ring-white/10`} />;
    case 'frame':
      return <Avatar avatar="av-classic" frame={it.id} size={small ? 64 : 110} />;
    case 'skin':
      return <ChickenSprite body={it.color} className={sz} />;
    case 'ball':
      return <div className={`${small ? 'h-12 w-10' : 'h-20 w-16'} rounded-[50%]`} style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${it.color} 40%, #000a)`, boxShadow: `0 0 30px ${it.color}` }} />;
    case 'title':
      return <div className={`rounded-xl border px-3 py-2 font-display font-black uppercase tracking-wider ${small ? 'text-xs' : 'text-sm'} ${RARITY_STYLE[it.rarity]}`}>{it.name}</div>;
  }
}

