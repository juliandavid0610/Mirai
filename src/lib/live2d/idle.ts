import { clamp, damp, mulberry32 } from '@/lib/utils/math';

/**
 * Secondary idle motion layered on top of whatever the rig's own idle
 * animation is doing.
 *
 * The Cubism runtime already gives you auto-blink and a breath curve, so this
 * controller deliberately does *not* touch eyes or breathing. What a canned
 * idle loop cannot do is be aperiodic: a 6-second loop reads as a loop within
 * about twenty seconds of watching. Summing three incommensurable sines gives
 * drift that never visibly repeats, for four lines of maths.
 */
export interface IdleSway {
  angleX: number;
  angleY: number;
  angleZ: number;
  bodyAngleX: number;
}

const ZERO: IdleSway = { angleX: 0, angleY: 0, angleZ: 0, bodyAngleX: 0 };

export interface IdleOptions {
  /** Overall strength, 0 disables the layer entirely. */
  amplitude: number;
  /** Multiplier on all drift rates. */
  speed: number;
  /** Seed for the nod scheduler, so runs are reproducible. */
  seed: number;
}

export const DEFAULT_IDLE: IdleOptions = {
  amplitude: 1,
  speed: 1,
  seed: 0x5eed,
};

export class IdleController {
  private options: IdleOptions;
  private random: () => number;
  private time = 0;
  /** Countdown to the next spontaneous glance, in seconds. */
  private nextNod: number;
  /** Progress through the current nod, or null when not nodding. */
  private nod: { elapsed: number; duration: number; depth: number } | null =
    null;
  private attention = 0;

  constructor(options: Partial<IdleOptions> = {}) {
    this.options = { ...DEFAULT_IDLE, ...options };
    this.random = mulberry32(this.options.seed);
    this.nextNod = this.scheduleNod();
  }

  configure(options: Partial<IdleOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Raises attention to `level` (0…1). The stage calls this while the
   * assistant is speaking so the idle drift calms down and the head settles —
   * a character that keeps wandering while it talks to you looks distracted.
   */
  setAttention(level: number): void {
    this.attention = clamp(level, 0, 1);
  }

  /** Triggers a deliberate nod, e.g. on acknowledging a user message. */
  triggerNod(depth = 1): void {
    this.nod = { elapsed: 0, duration: 0.55, depth: clamp(depth, 0, 1) };
  }

  private scheduleNod(): number {
    // Somewhere between 7 and 19 seconds.
    return 7 + this.random() * 12;
  }

  update(deltaSeconds: number): IdleSway {
    const { amplitude, speed } = this.options;
    if (amplitude <= 0) return ZERO;

    this.time += deltaSeconds * speed;
    const t = this.time;

    // Drift is damped while attentive but never fully frozen — a perfectly
    // still character reads as a crashed renderer.
    const calm = 1 - this.attention * 0.65;
    const scale = amplitude * calm;

    // Three periods with irrational ratios: never lines back up.
    const angleX =
      (Math.sin(t * 0.31) * 2.6 +
        Math.sin(t * 0.73 + 1.1) * 1.3 +
        Math.sin(t * 1.27 + 2.4) * 0.6) *
      scale;
    let angleY =
      (Math.sin(t * 0.27 + 0.6) * 1.8 + Math.sin(t * 0.61 + 2.2) * 0.9) * scale;
    let angleZ =
      (Math.sin(t * 0.19 + 1.7) * 2.2 + Math.sin(t * 0.47 + 0.3) * 1.1) * scale;
    const bodyAngleX = Math.sin(t * 0.23 + 0.9) * 1.4 * scale;

    this.nextNod -= deltaSeconds;
    if (this.nextNod <= 0 && !this.nod) {
      this.nod = { elapsed: 0, duration: 0.7, depth: 0.4 + this.random() * 0.4 };
      this.nextNod = this.scheduleNod();
    }

    if (this.nod) {
      this.nod.elapsed += deltaSeconds;
      const progress = this.nod.elapsed / this.nod.duration;
      if (progress >= 1) {
        this.nod = null;
      } else {
        // One full sine period: down and back up, zero at both ends.
        const curve = Math.sin(progress * Math.PI * 2);
        angleY -= curve * 9 * this.nod.depth;
        angleZ += curve * 2.5 * this.nod.depth;
      }
    }

    return { angleX, angleY, angleZ, bodyAngleX };
  }

  reset(): void {
    this.time = 0;
    this.nod = null;
    this.attention = 0;
    this.random = mulberry32(this.options.seed);
    this.nextNod = this.scheduleNod();
  }
}

/**
 * Smooths pointer position into a focus target.
 *
 * `Live2DModel.focus()` interpolates internally, but it snaps hard when the
 * pointer jumps across the stage (or when a touch begins). Pre-damping the
 * input keeps the head movement graceful in both cases.
 */
export class FocusSmoother {
  private x = 0;
  private y = 0;

  update(targetX: number, targetY: number, deltaSeconds: number) {
    this.x = damp(this.x, targetX, 0.0001, deltaSeconds);
    this.y = damp(this.y, targetY, 0.0001, deltaSeconds);
    return { x: this.x, y: this.y };
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
  }
}
