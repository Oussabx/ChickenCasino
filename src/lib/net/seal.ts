/**
 * Private cards over a shared room. Every page publishes an ECDH public key;
 * the host encrypts each player's hole cards with a key only that player can
 * derive (ECDH P-256 → AES-GCM). Everyone else just sees ciphertext.
 */

const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface KeyPair { pub: string; priv: CryptoKey | null }

/** One key pair per page load. Without WebCrypto, cards are sent as plain text. */
export async function makeKeys(): Promise<KeyPair> {
  if (!subtle) return { pub: '', priv: null };
  try {
    const k = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    return { pub: b64(await subtle.exportKey('raw', k.publicKey)), priv: k.privateKey };
  } catch { return { pub: '', priv: null }; }
}

const derived = new Map<string, Promise<CryptoKey>>();
function shared(priv: CryptoKey, otherPub: string) {
  let k = derived.get(otherPub);
  if (!k) {
    k = subtle!.importKey('raw', unb64(otherPub), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      .then((pub) => subtle!.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 128 }, false, ['encrypt', 'decrypt']));
    derived.set(otherPub, k);
  }
  return k;
}

/** Encrypt `text` for the owner of `theirPub`. Returns "p:<text>" when encryption isn't possible. */
export async function seal(mine: KeyPair, theirPub: string | undefined, text: string): Promise<string> {
  if (!mine.priv || !theirPub) return `p:${text}`;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle!.encrypt({ name: 'AES-GCM', iv }, await shared(mine.priv, theirPub), new TextEncoder().encode(text));
    return `${b64(iv)}.${b64(ct)}`;
  } catch { return `p:${text}`; }
}

/** Decrypt something the host sealed for us (`hostPub` = the host's public key). */
export async function unseal(mine: KeyPair, hostPub: string | undefined, sealed: string): Promise<string | null> {
  if (sealed.startsWith('p:')) return sealed.slice(2);
  if (!mine.priv || !hostPub) return null;
  try {
    const [iv, ct] = sealed.split('.');
    const pt = await subtle!.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await shared(mine.priv, hostPub), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}
