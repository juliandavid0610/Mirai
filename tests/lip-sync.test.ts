import { describe, expect, it } from 'vitest';
import {
  LipSyncDriver,
  TextEnvelope,
  countSyllables,
} from '@/lib/live2d/lip-sync';

const FRAME = 1 / 60;

/** Runs `frames` updates at a fixed amplitude and returns the final state. */
function drive(driver: LipSyncDriver, amplitude: number, frames: number) {
  let state = { open: 0, form: 0 };
  for (let i = 0; i < frames; i += 1) {
    state = driver.update(amplitude, FRAME);
  }
  return state;
}

describe('LipSyncDriver', () => {
  it('keeps the mouth shut on silence', () => {
    const driver = new LipSyncDriver();
    expect(drive(driver, 0, 30).open).toBeLessThan(0.01);
  });

  it('keeps the mouth shut on signal below the noise gate', () => {
    const driver = new LipSyncDriver({ gate: 0.05 });
    // 0.01 is typical room tone; without a gate this reads as a slack jaw.
    expect(drive(driver, 0.01, 60).open).toBeLessThan(0.01);
  });

  it('opens the mouth on speech-level signal', () => {
    const driver = new LipSyncDriver();
    expect(drive(driver, 0.3, 30).open).toBeGreaterThan(0.4);
  });

  it('never exceeds the configured ceiling', () => {
    const driver = new LipSyncDriver({ ceiling: 0.8 });
    expect(drive(driver, 1, 120).open).toBeLessThanOrEqual(0.8 + 1e-6);
  });

  it('stays within 0…1 for absurd input', () => {
    const driver = new LipSyncDriver();
    for (const amplitude of [-5, 0, 0.5, 12, Number.NaN]) {
      const { open } = driver.update(amplitude, FRAME);
      expect(open).toBeGreaterThanOrEqual(0);
      expect(open).toBeLessThanOrEqual(1);
    }
  });

  /**
   * The asymmetry is the point: jaws open fast and close slowly. If these two
   * ever converge the mouth either flaps or goes sluggish.
   */
  it('opens faster than it closes', () => {
    const opening = new LipSyncDriver();
    const openedAfter3 = drive(opening, 0.4, 3).open;

    const closing = new LipSyncDriver();
    drive(closing, 0.4, 60);
    const beforeClose = closing.update(0.4, FRAME).open;
    const afterClose = drive(closing, 0, 3).open;

    const openedFraction = openedAfter3;
    const closedFraction = beforeClose - afterClose;
    expect(openedFraction).toBeGreaterThan(closedFraction);
  });

  it('normalises quiet and loud sources to a similar range', () => {
    const quiet = new LipSyncDriver();
    const loud = new LipSyncDriver();
    const quietOpen = drive(quiet, 0.12, 90).open;
    const loudOpen = drive(loud, 0.9, 90).open;
    // A fixed gain would leave these far apart; the decaying peak keeps them
    // within a usable band of each other.
    expect(Math.abs(quietOpen - loudOpen)).toBeLessThan(0.35);
  });

  it('returns to rest after reset', () => {
    const driver = new LipSyncDriver();
    drive(driver, 0.6, 60);
    driver.reset();
    expect(driver.update(0, FRAME).open).toBeLessThan(0.01);
  });

  it('tolerates a zero or negative delta without producing NaN', () => {
    const driver = new LipSyncDriver();
    expect(driver.update(0.5, 0).open).toBe(0);
    expect(Number.isNaN(driver.update(0.5, -1).open)).toBe(false);
  });
});

describe('countSyllables', () => {
  it.each([
    ['hello', 2],
    ['cat', 1],
    ['the', 1],
    ['beautiful', 3],
    ['code', 1],
  ])('counts %s as %i', (word, expected) => {
    expect(countSyllables(word)).toBe(expected);
  });

  it('never returns zero', () => {
    for (const word of ['', 'a', 'rhythm', '!!!', '123']) {
      expect(countSyllables(word)).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives CJK text a per-glyph beat', () => {
    expect(countSyllables('こんにちは')).toBeGreaterThan(1);
  });
});

describe('TextEnvelope', () => {
  it('scales duration with the length of the text', () => {
    const short = new TextEnvelope('Hi there.');
    const long = new TextEnvelope('Hi there. '.repeat(20));
    expect(long.duration).toBeGreaterThan(short.duration);
  });

  it('has a floor on duration so a one-word reply still animates', () => {
    expect(new TextEnvelope('Yes').duration).toBeGreaterThanOrEqual(400);
  });

  it('is silent once the utterance is over', () => {
    const envelope = new TextEnvelope('A short sentence.');
    expect(envelope.sample(envelope.duration + 1)).toBe(0);
  });

  it('produces movement during the utterance', () => {
    const envelope = new TextEnvelope(
      'This sentence has enough syllables to pulse.',
    );
    let peak = 0;
    for (let t = 0; t < envelope.duration; t += 8) {
      peak = Math.max(peak, envelope.sample(t));
    }
    expect(peak).toBeGreaterThan(0.4);
  });

  it('stays within 0…1 throughout', () => {
    const envelope = new TextEnvelope('Checking the bounds of the envelope.');
    for (let t = -50; t < envelope.duration + 50; t += 5) {
      const value = envelope.sample(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
