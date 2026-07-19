import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRateLimits,
  clientKey,
  rateLimit,
  rateLimitHeaders,
} from '@/lib/utils/rate-limit';

beforeEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit('a', 3, 60).ok).toBe(true);
    }
  });

  it('rejects past the limit', () => {
    for (let i = 0; i < 3; i += 1) rateLimit('b', 3, 60);
    expect(rateLimit('b', 3, 60).ok).toBe(false);
  });

  it('counts each key independently', () => {
    rateLimit('c', 1, 60);
    expect(rateLimit('c', 1, 60).ok).toBe(false);
    expect(rateLimit('d', 1, 60).ok).toBe(true);
  });

  it('reports the remaining budget', () => {
    expect(rateLimit('e', 5, 60).remaining).toBe(4);
    expect(rateLimit('e', 5, 60).remaining).toBe(3);
  });

  it('never reports a negative remaining budget', () => {
    for (let i = 0; i < 10; i += 1) rateLimit('f', 2, 60);
    expect(rateLimit('f', 2, 60).remaining).toBe(0);
  });

  it('opens a fresh window once the old one expires', () => {
    vi.useFakeTimers();
    rateLimit('g', 1, 1);
    expect(rateLimit('g', 1, 1).ok).toBe(false);

    vi.advanceTimersByTime(1_100);
    expect(rateLimit('g', 1, 1).ok).toBe(true);
  });
});

describe('clientKey', () => {
  it('uses the first entry of x-forwarded-for', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(clientKey(request, 'chat')).toBe('chat:203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-real-ip': '198.51.100.2' },
    });
    expect(clientKey(request, 'chat')).toBe('chat:198.51.100.2');
  });

  it('falls back to a constant when no address is present', () => {
    const request = new Request('https://example.com');
    expect(clientKey(request, 'speech')).toBe('speech:anonymous');
  });

  it('namespaces by scope so routes do not share a budget', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-real-ip': '198.51.100.2' },
    });
    expect(clientKey(request, 'chat')).not.toBe(
      clientKey(request, 'transcribe'),
    );
  });
});

describe('rateLimitHeaders', () => {
  it('emits the standard RateLimit headers', () => {
    const headers = rateLimitHeaders(rateLimit('h', 10, 60)) as Record<
      string,
      string
    >;
    expect(headers['RateLimit-Limit']).toBe('10');
    expect(headers['RateLimit-Remaining']).toBe('9');
    expect(Number(headers['RateLimit-Reset'])).toBeGreaterThan(0);
  });
});
