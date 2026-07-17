import '@testing-library/dom';

/**
 * jsdom does not implement the browser APIs the animation and audio layers
 * touch. Rather than mock them per-test, the missing pieces are stubbed once
 * here with just enough behaviour for the pure logic under test to run.
 */

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}

if (!globalThis.performance?.now) {
  Object.defineProperty(globalThis, 'performance', {
    value: { now: () => 0 },
    writable: true,
  });
}
