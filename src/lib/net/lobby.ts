import { useEffect, useSyncExternalStore } from 'react';
import { NetRoom, joinLobby } from './room';

/**
 * The lobby: every open page says which live table it's at (and whether it's
 * sitting), so the table list can show who's playing where.
 */

let room: NetRoom | null = null;
let starting: Promise<NetRoom> | null = null;
let counts: Record<string, { seated: number; watching: number }> = {};
let online = 0;
type Kind = 'live' | 'local' | null;
let kind = null as Kind;
const subs = new Set<() => void>();
let snap: { counts: typeof counts; kind: Kind; online: number } = { counts, kind, online };

function recount() {
  if (!room) return;
  const next: typeof counts = {};
  const peers = room.peers();
  for (const p of peers) {
    const at = p.presence.at;
    if (typeof at !== 'string') continue;
    const c = (next[at] ??= { seated: 0, watching: 0 });
    if (!p.presence.sat) c.watching++;
    // pages at a table report how many seats are taken (house bots included)
    const n = typeof p.presence.n === 'number' ? p.presence.n : p.presence.sat ? 1 : 0;
    c.seated = Math.max(c.seated, n);
  }
  counts = next;
  online = peers.length;
  snap = { counts, kind, online };
  subs.forEach((f) => f());
}

function ensure() {
  if (!starting) {
    starting = joinLobby().then((r) => {
      room = r; kind = r.kind;
      r.onPeers(recount);
      recount();
      return r;
    });
  }
  return starting;
}

/** Live player counts per table id. */
export function useLobby() {
  useEffect(() => { ensure(); }, []);
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snap);
}

/** Tell the lobby where this page is (null = not at a table). */
export function setLobbyPresence(at: string | null, seated = false, n = 0) {
  ensure().then((r) => r.presence({ at, sat: at ? seated : null, n: at ? n : null }));
}
