import type { Application } from 'pixi.js';
import type { InternalModel, Live2DModel } from 'pixi-live2d-display';
import type { Emotion } from '@/types/emotion';
import type { ModelDescriptor, StageStatus } from '@/types/live2d';
import { clamp, clamp01, damp } from '@/lib/utils/math';
import { createLogger } from '@/lib/utils/logger';
import {
  EMOTION_POSES,
  POSE_SLOTS,
  blendModeFor,
  restValue,
  scalePose,
  type EmotionPose,
} from './expression-map';
import { IdleController, FocusSmoother } from './idle';
import { LipSyncDriver } from './lip-sync';
import { ParameterWriter, type ParameterSlot } from './parameter-writer';
import { loadPixiRuntime } from './runtime';

const log = createLogger('stage');

/** Returns the current audio loudness, 0…1. */
export type AmplitudeSource = () => number;

export interface StageOptions {
  canvas: HTMLCanvasElement;
  descriptor: ModelDescriptor;
  onStatus?: (status: StageStatus, detail?: string) => void;
  onReady?: (stage: MiraiStage) => void;
}

export interface StageDiagnostics {
  modelId: string;
  cubism: 2 | 4;
  emotion: Emotion;
  intensity: number;
  mouthOpen: number;
  fps: number;
  hasExpressions: boolean;
  unsupportedParameters: string[];
}

/**
 * Owns the PixiJS application, the loaded rig, and every animation layer that
 * writes to it.
 *
 * The one architectural decision worth calling out: all parameter writes
 * happen inside the model's `beforeModelUpdate` hook rather than on a Pixi
 * ticker callback. The Cubism update order is
 *
 *   motion → expression → physics → **beforeModelUpdate** → coreModel.update()
 *
 * so this is the only point where a write is guaranteed to survive to the
 * rendered frame. Writing from a ticker callback instead appears to work and
 * then mysteriously gets overwritten the moment a motion starts playing.
 */
export class MiraiStage {
  private app: Application;
  private model: Live2DModel<InternalModel>;
  private writer: ParameterWriter;
  private descriptor: ModelDescriptor;

  private readonly idle = new IdleController();
  private readonly focusSmoother = new FocusSmoother();
  private readonly lipSync = new LipSyncDriver();

  /** Where the face is heading. */
  private targetPose: EmotionPose = {};
  /** Where the face is right now; damped toward `targetPose` each frame. */
  private livePose: Record<string, number> = {};

  private emotion: Emotion = 'neutral';
  private intensity = 1;
  private expressiveness = 1;
  private speaking = false;
  private amplitudeSource: AmplitudeSource | null = null;
  private poseWeight = 1;
  private lastMouth = 0;
  private focusTarget = { x: 0, y: 0 };
  private disposed = false;
  private detachListeners: Array<() => void> = [];

  private constructor(
    app: Application,
    model: Live2DModel<InternalModel>,
    descriptor: ModelDescriptor,
  ) {
    this.app = app;
    this.model = model;
    this.descriptor = descriptor;
    this.writer = new ParameterWriter(
      model.internalModel.coreModel,
      descriptor.cubism,
      descriptor.parameters,
    );

    // A rig with authored expression files gets the parameter layer at partial
    // weight so the artist's work stays dominant; a rig without them relies on
    // the parameter layer entirely.
    this.poseWeight = descriptor.expressions ? 0.45 : 1;

    for (const slot of POSE_SLOTS) {
      this.livePose[slot] = restValue(slot);
    }

    this.setEmotion('neutral', 1);
    this.bind();
  }

  static async create(options: StageOptions): Promise<MiraiStage> {
    const { canvas, descriptor, onStatus } = options;

    onStatus?.('loading-runtime');
    // Sequential on purpose: the Cubism core has to be on `window` before the
    // runtime module is imported. See loadPixiRuntime.
    const { PIXI, Live2DModel } = await loadPixiRuntime(descriptor.cubism);

    const parent = canvas.parentElement;
    const width = parent?.clientWidth || canvas.clientWidth || 640;
    const height = parent?.clientHeight || canvas.clientHeight || 720;

    const app = new PIXI.Application({
      view: canvas,
      width,
      height,
      // Transparent so the app's own gradient backdrop shows through.
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      // Capped at 2: beyond that the fill-rate cost on a 4K display is real
      // and the visual difference on a soft-shaded rig is not.
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
      powerPreference: 'high-performance',
      sharedTicker: true,
    });

    onStatus?.('loading-model');
    log.info('loading model', descriptor.id, descriptor.url);

    const model = (await Live2DModel.from(descriptor.url, {
      // Pixi 6's InteractionManager would work, but pointer handling is driven
      // explicitly so focus can be smoothed and shared with the idle layer.
      autoInteract: false,
      autoUpdate: true,
    })) as Live2DModel<InternalModel>;

    app.stage.addChild(model);

    const stage = new MiraiStage(app, model, descriptor);
    stage.layout();
    onStatus?.('ready');
    options.onReady?.(stage);
    return stage;
  }

  // ───────────────────────────────── wiring ─────────────────────────────────

  private bind(): void {
    const onBeforeModelUpdate = () => this.applyFrame();
    this.model.internalModel.on('beforeModelUpdate', onBeforeModelUpdate);
    this.detachListeners.push(() =>
      this.model.internalModel.off('beforeModelUpdate', onBeforeModelUpdate),
    );
  }

  /** Runs once per rendered frame, immediately before the rig is flushed. */
  private applyFrame(): void {
    if (this.disposed) return;

    const deltaSeconds = clamp(this.app.ticker.deltaMS / 1000, 0, 0.1);

    // 1. Ease the live pose toward the target so emotion changes are a
    //    transition rather than a cut.
    for (const slot of POSE_SLOTS) {
      const target = this.targetPose[slot] ?? restValue(slot);
      const current = this.livePose[slot] ?? restValue(slot);
      this.livePose[slot] = damp(current, target, 0.0005, deltaSeconds);
    }

    // 2. Idle sway, calmed while speaking.
    this.idle.setAttention(this.speaking ? 1 : 0);
    const sway = this.idle.update(deltaSeconds);

    // 3. Smoothed head tracking.
    const focus = this.focusSmoother.update(
      this.focusTarget.x,
      this.focusTarget.y,
      deltaSeconds,
    );
    this.model.focus(focus.x, focus.y);

    // 4. Write the pose. Angles accumulate, eye-open multiplies, the rest is
    //    absolute — see SLOT_BLEND for why.
    for (const slot of POSE_SLOTS) {
      const value = this.livePose[slot] ?? restValue(slot);
      this.write(slot, value, this.poseWeight);
    }

    this.write('angleX', sway.angleX, 1, 'add');
    this.write('angleY', sway.angleY, 1, 'add');
    this.write('angleZ', sway.angleZ, 1, 'add');
    this.write('bodyAngleX', sway.bodyAngleX, 1, 'add');

    // 5. Lip sync last, so nothing can stomp on the mouth.
    const amplitude = this.speaking ? (this.amplitudeSource?.() ?? 0) : 0;
    const mouth = this.lipSync.update(amplitude, deltaSeconds);
    this.lastMouth = mouth.open;
    this.writer.set('mouthOpen', mouth.open);
    if (mouth.open > 0.02) {
      this.writer.set('mouthForm', mouth.form, 0.8);
    }
  }

  private write(
    slot: ParameterSlot,
    value: number,
    weight: number,
    forceMode?: 'set' | 'add' | 'multiply',
  ): void {
    const mode = forceMode ?? blendModeFor(slot);
    if (mode === 'set') {
      this.writer.set(slot, value, weight);
      return;
    }
    const current = this.writer.get(slot);
    if (mode === 'add') {
      this.writer.set(slot, current + value * weight);
    } else {
      // Multiply, weighted back toward 1 (the identity) so partial weights
      // shade the effect instead of inverting it.
      const factor = 1 + (value - 1) * weight;
      this.writer.set(slot, clamp(current * factor, 0, 2));
    }
  }

  // ───────────────────────────────── public ─────────────────────────────────

  /** Switches the emotional state, firing the rig's expression and motion. */
  setEmotion(emotion: Emotion, intensity = 1): void {
    const strength = clamp01(intensity) * this.expressiveness;
    const changed = emotion !== this.emotion;
    this.emotion = emotion;
    this.intensity = strength;
    this.targetPose = scalePose(EMOTION_POSES[emotion], strength);

    if (!changed) return;

    const expression = this.descriptor.expressions?.[emotion];
    if (expression) {
      void this.model.expression(expression).catch((error: unknown) => {
        log.warn('expression failed', expression, error);
      });
    }

    const motion = this.descriptor.motions?.[emotion];
    if (motion && strength > 0.55) {
      // Only strong cues get a whole-body motion; otherwise the character
      // gesticulates on every sentence.
      void this.model.motion(motion.group, motion.index).catch(() => {
        /* a missing motion group is not worth surfacing */
      });
    }
  }

  /** Plays a named motion group, used by tap interactions. */
  playMotion(group: string, index?: number): void {
    void this.model.motion(group, index).catch(() => {});
  }

  /** Nudges the head, e.g. to acknowledge a sent message. */
  nod(depth = 0.8): void {
    this.idle.triggerNod(depth);
  }

  setSpeaking(speaking: boolean): void {
    this.speaking = speaking;
    if (!speaking) this.lipSync.reset();
  }

  setAmplitudeSource(source: AmplitudeSource | null): void {
    this.amplitudeSource = source;
  }

  /** 0 = stoic, 1 = fully expressive. Mirrors the persona setting. */
  setExpressiveness(value: number): void {
    this.expressiveness = clamp01(value);
    this.targetPose = scalePose(
      EMOTION_POSES[this.emotion],
      this.intensity * this.expressiveness,
    );
  }

  setIdleAmplitude(value: number): void {
    this.idle.configure({ amplitude: clamp(value, 0, 2) });
  }

  /** Pointer position in CSS pixels relative to the canvas. */
  setFocus(x: number, y: number): void {
    this.focusTarget = { x, y };
  }

  clearFocus(): void {
    const { width, height } = this.app.screen;
    this.focusTarget = { x: width / 2, y: height / 2 };
  }

  /** Hit-tests the rig and plays the matching motion group if one is hit. */
  tap(x: number, y: number): string[] {
    const hits = this.model.hitTest(x, y);
    if (hits.length > 0) {
      this.model.tap(x, y);
      this.idle.triggerNod(0.5);
    }
    return hits;
  }

  /** Re-fits the model after a container resize. */
  layout(): void {
    if (this.disposed) return;
    const parent = this.app.view as HTMLCanvasElement;
    const container = parent.parentElement;
    const width = container?.clientWidth || this.app.screen.width;
    const height = container?.clientHeight || this.app.screen.height;
    if (width <= 0 || height <= 0) return;

    this.app.renderer.resize(width, height);

    const { transform } = this.descriptor;
    const intrinsic = this.model.internalModel.height || 1;
    // Fit by height: portrait rigs are height-dominant, and matching width
    // instead makes tall models overflow the top of the stage on mobile.
    const scale = (height * transform.scale) / intrinsic;

    this.model.anchor.set(transform.anchorX, transform.anchorY);
    this.model.scale.set(scale);
    this.model.position.set(
      width * transform.anchorX + transform.offsetX,
      height * transform.anchorY + transform.offsetY,
    );
    this.clearFocus();
  }

  diagnostics(): StageDiagnostics {
    return {
      modelId: this.descriptor.id,
      cubism: this.descriptor.cubism,
      emotion: this.emotion,
      intensity: this.intensity,
      mouthOpen: this.lastMouth,
      fps: Math.round(this.app.ticker.FPS),
      hasExpressions: Boolean(this.descriptor.expressions),
      unsupportedParameters: this.writer.unsupported(),
    };
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const detach of this.detachListeners) detach();
    this.detachListeners = [];
    this.amplitudeSource = null;
    try {
      this.model.destroy({ children: true });
      // `removeView: false` — React owns the <canvas> element, so tearing it
      // out of the DOM here would break remounting in strict mode.
      this.app.destroy(false, { children: true, texture: true, baseTexture: true });
    } catch (error) {
      log.warn('destroy failed', error);
    }
  }
}
