import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameData, toast, useStore } from '../store';

/**
 * Local account system. There is no server, so accounts live in this
 * browser's localStorage. Passwords and recovery codes are never stored in
 * plain text — only salted PBKDF2-SHA256 hashes.
 */

export interface Account {
  username: string;
  email?: string;
  createdAt: number;
  salt?: string;
  hash?: string;
  rSalt?: string;
  rHash?: string;
  /** Profiles created before passwords existed: the first password used claims them. */
  needsPassword?: boolean;
  data?: GameData;
}

interface AccountsState {
  accounts: Record<string, Account>;
  failures: { count: number; lockedUntil: number };
}

export const useAccounts = create<AccountsState>()(
  persist(() => ({ accounts: {}, failures: { count: 0, lockedUntil: 0 } }), { name: 'chicken-casino-accounts' }),
);

const key = (name: string) => name.trim().toLowerCase();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const randomSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

async function hashSecret(secret: string, salt: string) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: 150_000 },
    base,
    256,
  );
  return b64(bits);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return chars.match(/.{4}/g)!.join('-');
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ---------------- validation ---------------- */

export const USERNAME_RE = /^[A-Za-z0-9_]{3,18}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordChecks(pw: string) {
  return [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'A letter and a number', ok: /[A-Za-z]/.test(pw) && /\d/.test(pw) },
    { label: 'Upper & lower case', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), optional: true },
    { label: 'A symbol', ok: /[^A-Za-z0-9]/.test(pw), optional: true },
  ];
}
export const passwordValid = (pw: string) => passwordChecks(pw).every((c) => c.optional || c.ok);
export function passwordStrength(pw: string) {
  if (!pw) return 0;
  let s = passwordChecks(pw).filter((c) => c.ok).length;
  if (pw.length >= 12) s++;
  return Math.min(4, s); // 0..4
}

export function findAccount(identifier: string): Account | undefined {
  const id = key(identifier);
  const { accounts } = useAccounts.getState();
  return accounts[id] ?? Object.values(accounts).find((a) => a.email && key(a.email) === id);
}
export const usernameTaken = (name: string) => !!useAccounts.getState().accounts[key(name)];
export const emailTaken = (email: string) =>
  !!email && Object.values(useAccounts.getState().accounts).some((a) => a.email && key(a.email) === key(email));

function saveAccount(a: Account) {
  useAccounts.setState((s) => ({ accounts: { ...s.accounts, [key(a.username)]: a } }));
}

/* ---------------- lockout ---------------- */

export function lockoutRemaining() {
  return Math.max(0, useAccounts.getState().failures.lockedUntil - Date.now());
}
function recordFailure() {
  const f = useAccounts.getState().failures;
  const count = f.count + 1;
  useAccounts.setState({ failures: { count: count >= 5 ? 0 : count, lockedUntil: count >= 5 ? Date.now() + 30_000 : f.lockedUntil } });
  return count >= 5 ? 'Too many attempts. Try again in 30 seconds.' : null;
}
const clearFailures = () => useAccounts.setState({ failures: { count: 0, lockedUntil: 0 } });

/* ---------------- session helpers ---------------- */

/** Persist the signed-in player's progress into their account record. */
export function saveSession() {
  const st = useStore.getState();
  if (!st.user) return;
  const a = findAccount(st.user.name);
  if (a) saveAccount({ ...a, data: st.exportData() });
}

function startSession(a: Account) {
  const st = useStore.getState();
  st.loadData(a.data ?? null);
  useStore.setState({ user: { name: a.username, joinedAt: a.createdAt, email: a.email } });
}

/* ---------------- public API ---------------- */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; field?: string };

export async function register(input: { username: string; email?: string; password: string; avatar: string }): Promise<Result<{ recoveryCode: string }>> {
  const username = input.username.trim();
  const email = input.email?.trim() || undefined;
  if (!USERNAME_RE.test(username)) return { ok: false, field: 'username', error: '3–18 letters, numbers or underscores' };
  if (usernameTaken(username)) return { ok: false, field: 'username', error: 'That username is already taken' };
  if (email && !EMAIL_RE.test(email)) return { ok: false, field: 'email', error: 'Enter a valid email' };
  if (email && emailTaken(email)) return { ok: false, field: 'email', error: 'An account already uses this email' };
  if (!passwordValid(input.password)) return { ok: false, field: 'password', error: 'Password is too weak' };

  saveSession();
  const salt = randomSalt(), rSalt = randomSalt();
  const recoveryCode = newRecoveryCode();
  const acc: Account = {
    username, email, createdAt: Date.now(),
    salt, hash: await hashSecret(input.password, salt),
    rSalt, rHash: await hashSecret(normCode(recoveryCode), rSalt),
  };
  saveAccount(acc);
  startSession(acc);
  const st = useStore.getState();
  st.equip(input.avatar);
  st.grant('bonus', 'Welcome bonus', 10000, 10);
  saveSession();
  return { ok: true, recoveryCode };
}

export async function login(identifier: string, password: string): Promise<Result> {
  const wait = lockoutRemaining();
  if (wait) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(wait / 1000)}s.` };
  const a = findAccount(identifier);
  if (!a) return (recordFailure(), { ok: false, field: 'identifier', error: 'No account with that username or email' });

  if (a.needsPassword) {
    if (!passwordValid(password)) return { ok: false, field: 'password', error: 'This older profile needs a new password: 8+ characters with a letter and a number' };
    const salt = randomSalt();
    saveAccount({ ...a, needsPassword: false, salt, hash: await hashSecret(password, salt) });
    toast({ title: 'Password set for your profile 🔒', desc: 'Create a recovery code in Settings → Security.', tone: 'green' });
  } else if ((await hashSecret(password, a.salt!)) !== a.hash) {
    const locked = recordFailure();
    return { ok: false, field: 'password', error: locked ?? 'Incorrect password' };
  }
  clearFailures();
  saveSession();
  startSession(findAccount(identifier)!);
  return { ok: true };
}

export function logout() {
  saveSession();
  useStore.getState().loadData(null);
  useStore.setState({ user: null });
}

export async function resetPassword(identifier: string, code: string, newPassword: string): Promise<Result<{ recoveryCode: string }>> {
  const wait = lockoutRemaining();
  if (wait) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(wait / 1000)}s.` };
  const a = findAccount(identifier);
  if (!a) return { ok: false, field: 'identifier', error: 'No account with that username or email' };
  if (!a.rHash || !a.rSalt) return { ok: false, field: 'code', error: 'This account has no recovery code set' };
  if ((await hashSecret(normCode(code), a.rSalt)) !== a.rHash) {
    const locked = recordFailure();
    return { ok: false, field: 'code', error: locked ?? 'That recovery code doesn’t match' };
  }
  if (!passwordValid(newPassword)) return { ok: false, field: 'password', error: 'Password is too weak' };
  clearFailures();
  // Recovery codes are single-use: rotate it.
  const salt = randomSalt(), rSalt = randomSalt();
  const recoveryCode = newRecoveryCode();
  saveAccount({ ...a, needsPassword: false, salt, hash: await hashSecret(newPassword, salt), rSalt, rHash: await hashSecret(normCode(recoveryCode), rSalt) });
  return { ok: true, recoveryCode };
}

async function verifyCurrent(a: Account, current: string) {
  return a.needsPassword || (await hashSecret(current, a.salt!)) === a.hash;
}

export async function changePassword(current: string, next: string): Promise<Result> {
  const a = findAccount(useStore.getState().user?.name ?? '');
  if (!a) return { ok: false, error: 'Not signed in' };
  if (!(await verifyCurrent(a, current))) return { ok: false, field: 'current', error: 'Current password is incorrect' };
  if (!passwordValid(next)) return { ok: false, field: 'password', error: 'Password is too weak' };
  const salt = randomSalt();
  saveAccount({ ...a, needsPassword: false, salt, hash: await hashSecret(next, salt) });
  return { ok: true };
}

export async function regenerateRecoveryCode(current: string): Promise<Result<{ recoveryCode: string }>> {
  const a = findAccount(useStore.getState().user?.name ?? '');
  if (!a) return { ok: false, error: 'Not signed in' };
  if (a.needsPassword) return { ok: false, error: 'Set a password first' };
  if (!(await verifyCurrent(a, current))) return { ok: false, field: 'current', error: 'Password is incorrect' };
  const rSalt = randomSalt();
  const recoveryCode = newRecoveryCode();
  saveAccount({ ...a, rSalt, rHash: await hashSecret(normCode(recoveryCode), rSalt) });
  return { ok: true, recoveryCode };
}

export function renameAccount(next: string): Result {
  const st = useStore.getState();
  const a = st.user && findAccount(st.user.name);
  if (!a) return { ok: false, error: 'Not signed in' };
  const name = next.trim();
  if (!USERNAME_RE.test(name)) return { ok: false, error: '3–18 letters, numbers or underscores' };
  if (key(name) !== key(a.username) && usernameTaken(name)) return { ok: false, error: 'That username is already taken' };
  useAccounts.setState((s) => {
    const accounts = { ...s.accounts };
    delete accounts[key(a.username)];
    accounts[key(name)] = { ...a, username: name };
    return { accounts };
  });
  useStore.setState({ user: { ...st.user!, name } });
  return { ok: true };
}

export function deleteAccount() {
  const st = useStore.getState();
  if (st.user) {
    useAccounts.setState((s) => {
      const accounts = { ...s.accounts };
      delete accounts[key(st.user!.name)];
      return { accounts };
    });
  }
  st.loadData(null);
  useStore.setState({ user: null });
}

export const currentAccount = () => findAccount(useStore.getState().user?.name ?? '');

/**
 * Profiles from before accounts existed only live in the game store. Give them
 * an account record (flagged needsPassword) so they keep working.
 */
export function migrateLegacyProfile() {
  const u = useStore.getState().user;
  if (u && !findAccount(u.name)) {
    saveAccount({ username: u.name, createdAt: u.joinedAt, needsPassword: true });
  }
}

// Keep the signed-in account's saved copy fresh (e.g. if the tab is closed).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', saveSession);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveSession());
}
