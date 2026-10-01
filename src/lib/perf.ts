import type * as THREE from 'three';
import { useStore } from '../store';

export type Effects = 'auto' | 'full' | 'lite';

/**
 * Phones, tablets and low-power laptops get "lite" effects automatically:
 * no frosted-glass bars, no drifting background, lighter 3D. Everything still
 * animates — just the expensive paint work is gone.
 */
export function autoLite() {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const fewCores = (nav.hardwareConcurrency ?? 8) <= 3;
  const lowMem = (nav.deviceMemory ?? 8) <= 2;
  return coarse || fewCores || lowMem;
}

const resolve = (e: Effects | undefined) => (e === 'lite' ? true : e === 'full' ? false : autoLite());

/** Current lite flag, read outside React (3D renderers). */
export const isLite = () => resolve(useStore.getState().settings.effects);

/** React hook version. */
export function useLite() {
  const e = useStore((s) => s.settings.effects);
  return resolve(e);
}

/**
 * Shared WebGL quality settings + dynamic resolution: if frames keep taking
 * longer than ~28ms the render scale steps down (never below 1×), so slow
 * devices settle at a smooth frame rate instead of stuttering.
 */
export class RenderBudget {
  private acc = 0;
  private n = 0;
  private ratio: number;
  /** false while the canvas is scrolled out of view — callers skip rendering. */
  visible = true;
  private io?: IntersectionObserver;

  constructor(private renderer: THREE.WebGLRenderer, private onChange: () => void) {
    const dpr = window.devicePixelRatio || 1;
    this.ratio = Math.min(isLite() ? 1.5 : 2, dpr);
    renderer.setPixelRatio(this.ratio);
  }

  /** Lighter shadows on lite devices. */
  static shadowSize() { return isLite() ? 1024 : 2048; }
  static softShadows() { return !isLite(); }

  watch(el: Element) {
    if (typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver((es) => { this.visible = es[es.length - 1].isIntersecting; });
    this.io.observe(el);
  }

  /** Call once per frame with the frame time in seconds. */
  tick(dt: number) {
    if (!this.visible || document.hidden) return;
    this.acc += dt; this.n++;
    if (this.acc < 2) return;
    const avg = this.acc / this.n;
    this.acc = 0; this.n = 0;
    if (avg > 0.028 && this.ratio > 1) {
      this.ratio = Math.max(1, +(this.ratio - 0.25).toFixed(2));
      this.renderer.setPixelRatio(this.ratio);
      this.onChange();
    }
  }

  dispose() { this.io?.disconnect(); }
}
