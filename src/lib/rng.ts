/** Cryptographically-strong float in [0, 1). */
export function rand(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

export const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
