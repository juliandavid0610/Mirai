'use client';

import { useEffect, useState } from 'react';
import type { ChatModelOption } from '@/types/chat';

export interface Capabilities {
  chat: boolean;
  speech: boolean;
  transcription: boolean;
  defaultModel: string;
  models: ChatModelOption[];
}

const OPTIMISTIC: Capabilities = {
  chat: true,
  speech: false,
  transcription: false,
  defaultModel: '',
  models: [],
};

/**
 * Asks the server what this deployment can do.
 *
 * Starts optimistic so the composer is never disabled during the first
 * round trip — a chat box that boots greyed-out reads as broken, and the worst
 * case of being wrong is one message that comes back in Rehearsal Mode.
 */
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities>(OPTIMISTIC);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/capabilities', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Capabilities | null) => {
        if (data) setCapabilities(data);
      })
      .catch(() => {
        /* offline or aborted — keep the optimistic defaults */
      })
      .finally(() => setLoaded(true));

    return () => controller.abort();
  }, []);

  return { capabilities, loaded, rehearsal: loaded && !capabilities.chat };
}
