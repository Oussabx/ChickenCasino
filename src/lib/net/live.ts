import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NetPeer, NetRoom, joinRoom } from './room';
import { KeyPair, makeKeys, seal, unseal } from './seal';
import { useStore } from '../../store';

/**
 * One live table, shared by everyone in its room.
 *
 * Every page keeps a small presence object: who it is, the seat it asked for,
 * its latest action. One page is the host: it runs the game engine and puts the
 * whole public table state in its own presence (`st`). Everyone renders from
 * that. If the host leaves, the next page in line takes over from the last state
 * it saw (a hand in progress is called off and the chips go back).
 */

export const PROTO = 2;
/** A new page listens this long before it may decide nobody is hosting. */
const GRACE = 2600;

export interface Ident { nm: string; av: string; fr: string; ns: string }

/** What a player page publishes about itself. */
export interface PlayerPresence {
  v: number;
  since: number;
  pk: string;
  id: Ident;
  sit?: { rid: string; seat: number; buy: number } | null;
  act?: { h: number; q: number; t: string; a?: number } | null;
  bet?: { r: number; a: number } | null;
  emo?: { e: string; at: number } | null;
  /** Roulette: this round's chips on the layout (for everyone to see). */
  rb?: { r: number; b: Record<string, number> } | null;
}

/** Fields every engine's public state carries. */
export interface BaseState {
  /** Version counter, carried over between hosts: the richer state wins a host clash. */
  seq: number;
  /** Removed seats and their final stacks, kept for a while so the owner can cash out. */
  out: { rid: string; k: number }[];
  /** Host's public key (for private cards) and the sealed cards per seat. */
  pk?: string;
  enc?: Record<string, string>;
  /** Ms left on the action clock when this state was published. */
  tl?: number;
}

export interface PeerView { peer: string; isMe: boolean; pres: Partial<PlayerPresence>; updatedAt: number }

export interface Engine<S extends BaseState> {
  /** Start from the last state seen from a previous host (null for a fresh table). */
  adopt(prev: S | null): void;
  /** Advance the game; returns true when the public state changed. */
  step(now: number, peers: PeerView[]): boolean;
  state(): S;
  /** Private text per seat for its owner: [seat index, owner's peer label, text]. Same `key` = unchanged. */
  secrets(): { key: string; list: [number, string, string][] };
}

const asPres = (p: NetPeer): Partial<PlayerPresence> & { st?: BaseState } => p.presence as Partial<PlayerPresence> & { st?: BaseState };

/** Who hosts: among pages already hosting, the most advanced state; otherwise the earliest arrival. */
function elect(peers: readonly NetPeer[]): { host: string | null; hosting: boolean } {
  const cands = peers.filter((p) => asPres(p).v === PROTO && typeof asPres(p).since === 'number');
  const hosts = cands.filter((p) => asPres(p).st);
  if (hosts.length) {
    hosts.sort((a, b) => (asPres(b).st!.seq - asPres(a).st!.seq) || (asPres(a).since! - asPres(b).since!) || (a.peer < b.peer ? -1 : 1));
    return { host: hosts[0].peer, hosting: true };
  }
  cands.sort((a, b) => (asPres(a).since! - asPres(b).since!) || (a.peer < b.peer ? -1 : 1));
  return { host: cands[0]?.peer ?? null, hosting: false };
}

export interface LiveSnapshot<S> {
  status: 'connecting' | 'live' | 'error';
  kind: 'live' | 'local';
  me: string | null;
  isHost: boolean;
  /** The table as the host last published it, and when it arrived (local clock). */
  state: S | null;
  stateAt: number;
  peers: PeerView[];
  /** This page's private text (e.g. hole cards), decrypted. */
  secret: string | null;
}

export class LiveTable<S extends BaseState> {
  private room: NetRoom | null = null;
  private keys: KeyPair = { pub: '', priv: null };
  private since = Date.now();
  private joinedAt = 0;
  private engine: Engine<S> | null = null;
  private loop = 0;
  private last: S | null = null;
  private snap: LiveSnapshot<S> = { status: 'connecting', kind: 'local', me: null, isHost: false, state: null, stateAt: 0, peers: [], secret: null };
  private subs = new Set<() => void>();
  private sealed: { key: string; enc: Record<string, string> } = { key: '', enc: {} };
  private sealing = false;
  private dirty = false;
  private secretKey = '';
  private closed = false;
  private unsub: (() => void) | null = null;

  constructor(private name: string, private makeEngine: () => Engine<S>, private ident: () => Ident) {}

  async start() {
    try {
      const [keys, room] = await Promise.all([makeKeys(), joinRoom(this.name)]);
      if (this.closed) { room.leave(); return; }
      this.keys = keys; this.room = room;
      this.joinedAt = Date.now();
      room.presence({ v: PROTO, since: this.since, pk: keys.pub, id: this.ident() });
      this.unsub = room.onPeers(() => this.update());
      this.loop = window.setInterval(() => this.tick(), 160);
      this.set({ status: 'live', kind: room.kind, me: room.me() });
    } catch {
      this.set({ status: 'error' });
    }
  }

  stop() {
    this.closed = true;
    clearInterval(this.loop);
    this.unsub?.();
    if (this.room) { this.room.presence({ st: null, sit: null }); this.room.leave(); }
    this.subs.clear();
  }

  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  get = () => this.snap;
  private set(p: Partial<LiveSnapshot<S>>) { this.snap = { ...this.snap, ...p }; this.subs.forEach((f) => f()); }

  /** Update this page's presence (seat request, action, bet, emote). */
  send(patch: Partial<Record<keyof PlayerPresence, unknown>>) { this.room?.presence(patch as Record<string, unknown>); }

  private views(peers: readonly NetPeer[]): PeerView[] {
    return peers.map((p) => ({ peer: p.peer, isMe: p.isMe, pres: asPres(p), updatedAt: p.updatedAt }));
  }

  private update() {
    const room = this.room; if (!room) return;
    const peers = room.peers();
    const me = room.me();
    const { host, hosting } = elect(peers);
    const amHost = !!me && host === me && (hosting || Date.now() - this.joinedAt > GRACE);
    const hostPeer = hosting ? peers.find((p) => p.peer === host) : undefined;
    const st = (hostPeer ? asPres(hostPeer).st : undefined) as S | undefined;
    if (st && hostPeer) this.last = st;

    if (amHost && !this.engine) {
      this.engine = this.makeEngine();
      this.engine.adopt(this.last);
      this.dirty = true;
    } else if (!amHost && this.engine) {
      // someone with a better claim is hosting: hand over
      this.engine = null;
      room.presence({ st: null });
    }
    const prevAt = this.snap.state === st ? this.snap.stateAt : hostPeer?.updatedAt ?? Date.now();
    this.set({ me, isHost: !!this.engine, peers: this.views(peers), state: st ?? (this.engine ? null : this.last), stateAt: prevAt });
    this.readSecret(st, me);
  }

  private tick() {
    const room = this.room;
    if (!room) return;
    // nobody is hosting and we've listened long enough: maybe it's us
    if (!this.engine && !this.snap.state && Date.now() - this.joinedAt > GRACE) this.update();
    if (!this.engine) return;
    if (this.engine.step(Date.now(), this.views(room.peers()))) this.dirty = true;
    if (this.dirty) this.publish();
  }

  private async publish() {
    if (this.sealing || !this.engine || !this.room) return;
    this.dirty = false;
    const eng = this.engine;
    const sec = eng.secrets();
    if (sec.key !== this.sealed.key) {
      this.sealing = true;
      const enc: Record<string, string> = {};
      const keyOf = new Map(this.room.peers().map((p) => [p.peer, asPres(p).pk]));
      await Promise.all(sec.list.map(async ([seat, peer, text]) => { enc[seat] = await seal(this.keys, keyOf.get(peer), text); }));
      this.sealed = { key: sec.key, enc };
      this.sealing = false;
      if (this.engine !== eng) return;
    }
    const st = { ...eng.state(), pk: this.keys.pub, enc: this.sealed.enc };
    this.room.presence({ st });
  }

  private async readSecret(st: S | undefined, me: string | null) {
    if (!st?.enc || !me) { if (this.snap.secret !== null && !st) this.set({ secret: null }); return; }
    const mySeat = (st as unknown as { s?: ({ p?: string } | null)[] }).s?.findIndex((x) => x?.p === me) ?? -1;
    const box = mySeat >= 0 ? st.enc[mySeat] : undefined;
    const key = `${st.pk}|${box ?? ''}`;
    if (key === this.secretKey) return;
    this.secretKey = key;
    if (!box) { this.set({ secret: null }); return; }
    const text = await unseal(this.keys, st.pk, box);
    if (this.secretKey === key) this.set({ secret: text });
  }
}

/** The player's look, from their profile and equipped cosmetics. */
export function myIdent(): Ident {
  const s = useStore.getState();
  return { nm: (s.user?.name ?? 'Guest').slice(0, 18), av: s.equipped.avatar, fr: s.equipped.frame, ns: s.equipped.name };
}

/** Join a table's room for as long as the component is mounted. */
export function useLiveTable<S extends BaseState>(name: string, makeEngine: () => Engine<S>) {
  const ref = useRef<LiveTable<S> | null>(null);
  const [lt, setLt] = useState<LiveTable<S> | null>(null);
  useEffect(() => {
    const t = new LiveTable<S>(name, makeEngine, myIdent);
    ref.current = t; setLt(t);
    t.start();
    return () => { t.stop(); ref.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  const empty = useRef<LiveSnapshot<S>>({ status: 'connecting', kind: 'local', me: null, isHost: false, state: null, stateAt: 0, peers: [], secret: null });
  const snap = useSyncExternalStore(lt?.subscribe ?? (() => () => {}), lt?.get ?? (() => empty.current));
  return { snap, table: lt };
}

/** A short random id for a seat session. */
export const rid = () => Math.random().toString(36).slice(2, 9);
