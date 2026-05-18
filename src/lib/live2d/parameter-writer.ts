import type { CubismVersion, ParameterMap } from '@/types/live2d';
import { parametersFor } from '@/types/live2d';

/**
 * Cubism 2 and Cubism 4 expose completely different core objects:
 *
 *   Cubism 2 → `setParamFloat(id, value, weight)`
 *   Cubism 4 → `setParameterValueById(id, value, weight)`
 *
 * and they do not even agree on parameter *names* (`PARAM_MOUTH_OPEN_Y` vs
 * `ParamMouthOpenY`). Rather than sprinkle version checks through the
 * animation code, everything funnels through this one adapter: the callers
 * speak in semantic slots (`mouthOpen`, `browLForm`) and never touch a raw id.
 */

interface Cubism4Core {
  setParameterValueById(id: string, value: number, weight?: number): void;
  getParameterValueById(id: string): number;
}

interface Cubism2Core {
  setParamFloat(id: string, value: number, weight?: number): void;
  getParamFloat(id: string): number;
}

type AnyCore = Partial<Cubism4Core & Cubism2Core>;

export type ParameterSlot = keyof ParameterMap;

export class ParameterWriter {
  private readonly core: AnyCore;
  private readonly map: ParameterMap;
  private readonly isV4: boolean;
  /** Ids that proved unwritable, so we stop paying for them every frame. */
  private readonly missing = new Set<string>();

  constructor(
    coreModel: object,
    cubism: CubismVersion,
    overrides?: Partial<ParameterMap>,
  ) {
    this.core = coreModel as AnyCore;
    this.map = { ...parametersFor(cubism), ...overrides };
    this.isV4 = typeof this.core.setParameterValueById === 'function';
  }

  /** Resolves a semantic slot to the concrete parameter id for this rig. */
  id(slot: ParameterSlot): string {
    return this.map[slot];
  }

  /**
   * Writes a value to a slot.
   *
   * @param weight 0…1 blend against whatever the motion already wrote. A
   *   weight below 1 is how lip sync layers on top of a talking animation
   *   without fighting it.
   */
  set(slot: ParameterSlot, value: number, weight = 1): void {
    this.setById(this.map[slot], value, weight);
  }

  setById(id: string, value: number, weight = 1): void {
    if (!id || this.missing.has(id) || !Number.isFinite(value)) return;
    try {
      if (this.isV4) {
        this.core.setParameterValueById?.(id, value, weight);
      } else {
        this.core.setParamFloat?.(id, value, weight);
      }
    } catch {
      // A rig that lacks this parameter is a normal, expected situation —
      // record it once and never try again rather than throwing per frame.
      this.missing.add(id);
    }
  }

  get(slot: ParameterSlot): number {
    return this.getById(this.map[slot]);
  }

  getById(id: string): number {
    if (!id || this.missing.has(id)) return 0;
    try {
      const value = this.isV4
        ? this.core.getParameterValueById?.(id)
        : this.core.getParamFloat?.(id);
      return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    } catch {
      this.missing.add(id);
      return 0;
    }
  }

  /** Slots this rig silently ignored — surfaced in the debug overlay. */
  unsupported(): string[] {
    return [...this.missing];
  }
}
