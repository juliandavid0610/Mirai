/**
 * A namespaced logger that stays quiet in production builds.
 *
 * The Live2D pipeline is chatty during development (runtime loading, model
 * parsing, motion transitions) and completely silent once shipped.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ENABLED = process.env.NODE_ENV !== 'production';

const STYLES: Record<Level, string> = {
  debug: 'color:#8b5cf6',
  info: 'color:#22d3ee',
  warn: 'color:#f59e0b',
  error: 'color:#ef4444',
};

function emit(level: Level, scope: string, args: unknown[]): void {
  // Errors are always surfaced; the rest is development-only noise.
  if (!ENABLED && level !== 'error') return;
  const method = level === 'debug' ? 'log' : level;
  console[method](`%c[mirai:${scope}]`, STYLES[level], ...args);
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => emit('debug', scope, args),
    info: (...args) => emit('info', scope, args),
    warn: (...args) => emit('warn', scope, args),
    error: (...args) => emit('error', scope, args),
  };
}
