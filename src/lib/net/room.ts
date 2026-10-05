/**
 * Live rooms for the multiplayer tables.
 *
 * Inside the published Claude artifact the page gets the platform's `room`
 * capability: everyone with the link open is in the same room, and each table
 * is a named room. Anywhere else (local dev, a plain web host) we fall back to a
 * BroadcastChannel room, which links the tabs of one browser, so a table still
 * runs (you + the house bots).
 *
 * Only the presence arm is used: every page keeps one small JSON object about
 * itself current (who it is, the seat it wants, its last action, and for the
 * host the whole public table state). Presence is absolute state, so a dropped
 * update never matters, and anyone may set it — no special send rights needed.
 */

export interface NetPeer {
  peer: string;
  isMe: boolean;
  presence: Readonly<Record<string, unknown>>;
  updatedAt: number;
}

export interface NetRoom {
  readonly kind: 'live' | 'local';
  /** This page's own peer label. */
  me(): string | null;
  peers(): readonly NetPeer[];
  onPeers(fn: (peers: readonly NetPeer[]) => void): () => void;
  presence(patch: Record<string, unknown>): void;
  connected(): boolean;
  leave(): void;
}

/* ---------------- platform room (Claude artifact) ---------------- */

interface ClaudeNamedRoom {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly { peer: string; isMe: boolean; sameTab: boolean; presence: Record<string, unknown>; updatedAt: number }[];
  onPeers(fn: (c: { peers: ReturnType<ClaudeNamedRoom['peers']> }) => void, onError?: (e: { code: string }) => void): () => void;
  connected(): boolean;
  leave?(): Promise<void>;
}
interface ClaudeRoom extends ClaudeNamedRoom { join(name: string): Promise<ClaudeNamedRoom> }

let platform: Promise<ClaudeRoom | null> | null = null;
/** The platform room namespace, or null when this page isn't running as a Claude artifact. */
export function platformRoom(): Promise<ClaudeRoom | null> {
  if (platform) return platform;
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!c?.use) return (platform = Promise.resolve(null));
  platform = Promise.race([
    c.use('room').then((r) => (r as ClaudeRoom) ?? null).catch(() => null),
    new Promise<null>((res) => setTimeout(() => res(null), 12000)),
  ]);
  return platform;
}

function wrapPlatform(r: ClaudeNamedRoom): NetRoom {
  // the platform hands the same frozen objects until something changes, so map once per change
  let cache: { src: unknown; out: NetPeer[] } = { src: null, out: [] };
  const map = () => {
    const src = r.peers();
    // your other tabs are separate players here (isMe means this tab only)
    if (src !== cache.src) cache = { src, out: src.map((p) => ({ peer: p.peer, isMe: p.sameTab, presence: p.presence ?? {}, updatedAt: p.updatedAt })) };
    return cache.out;
  };
  let mine: string | null = null;
  return {
    kind: 'live',
    me: () => mine ?? (mine = r.peers().find((p) => p.sameTab)?.peer ?? null),
    peers: map,
    onPeers: (fn) => r.onPeers(() => fn(map()), () => fn(map())),
    presence: (patch) => { r.presence(patch).catch(() => {}); },
    connected: () => r.connected(),
    leave: () => { r.leave?.().catch(() => {}); },
  };
}

/* ---------------- BroadcastChannel room (same browser) ---------------- */

const TTL = 6000;
function localRoom(name: string): NetRoom {
  const me = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cc-room:${name}`) : null;
  let mine: Record<string, unknown> = {};
  const others = new Map<string, { presence: Record<string, unknown>; json: string; updatedAt: number; seen: number }>();
  const subs = new Set<(p: readonly NetPeer[]) => void>();
  let snapshot: NetPeer[] = [];
  let myAt = Date.now();
  const rebuild = () => {
    snapshot = [{ peer: me, isMe: true, presence: mine, updatedAt: myAt }, ...[...others].map(([peer, o]) => ({ peer, isMe: false, presence: o.presence, updatedAt: o.updatedAt }))];
    subs.forEach((f) => f(snapshot));
  };
  const send = (t: 'p' | 'hello' | 'bye') => ch?.postMessage({ t, peer: me, p: t === 'p' ? mine : undefined });
  let pending = 0;
  const flush = () => { pending = 0; send('p'); };
  if (ch) ch.onmessage = (e) => {
    const m = e.data as { t: string; peer: string; p?: Record<string, unknown> };
    if (!m?.peer || m.peer === me) return;
    if (m.t === 'bye') { if (others.delete(m.peer)) rebuild(); return; }
    if (m.t === 'hello') send('p');
    if (m.t === 'p' && m.p) {
      const json = JSON.stringify(m.p);
      const o = others.get(m.peer);
      if (o && o.json === json) { o.seen = Date.now(); return; }
      others.set(m.peer, { presence: Object.freeze(m.p), json, updatedAt: Date.now(), seen: Date.now() });
      rebuild();
    }
  };
  const beat = setInterval(() => {
    send('p');
    let changed = false;
    const now = Date.now();
    others.forEach((o, k) => { if (now - o.seen > TTL) { others.delete(k); changed = true; } });
    if (changed) rebuild();
  }, 1500);
  const bye = () => send('bye');
  window.addEventListener('pagehide', bye);
  send('hello');
  rebuild();
  return {
    kind: 'local',
    me: () => me,
    peers: () => snapshot,
    onPeers: (fn) => { subs.add(fn); queueMicrotask(() => fn(snapshot)); return () => subs.delete(fn); },
    presence: (patch) => {
      const next = { ...mine };
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete next[k]; else next[k] = v; }
      mine = Object.freeze(next); myAt = Date.now();
      rebuild();
      if (!pending) pending = window.setTimeout(flush, 30);
    },
    connected: () => true,
    leave: () => { clearInterval(beat); window.removeEventListener('pagehide', bye); bye(); ch?.close(); subs.clear(); },
  };
}

/**
 * Join a named room (a table or a lobby). Joins are shared and counted: leaving
 * a table and coming straight back must not let the old page's "leave" close
 * the room the new one is using.
 */
const joined = new Map<string, { room: Promise<NetRoom>; refs: number }>();
export async function joinRoom(name: string): Promise<NetRoom> {
  let e = joined.get(name);
  if (!e) { e = { room: openRoom(name), refs: 0 }; joined.set(name, e); }
  e.refs++;
  const entry = e;
  const r = await entry.room;
  let left = false;
  return {
    kind: r.kind, me: r.me, peers: r.peers, onPeers: r.onPeers, presence: r.presence, connected: r.connected,
    leave: () => {
      if (left) return;
      left = true;
      if (--entry.refs <= 0) { joined.delete(name); r.leave(); }
    },
  };
}

async function openRoom(name: string): Promise<NetRoom> {
  const p = await platformRoom();
  if (p) {
    try { return wrapPlatform(await p.join(name)); } catch { /* fall through to the local room */ }
  }
  return localRoom(name);
}

/** The lobby: the platform's main room (everyone with the page open), or a local one. */
export async function joinLobby(): Promise<NetRoom> {
  const p = await platformRoom();
  if (p) return wrapPlatform(p);
  return localRoom('lobby');
}
