'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { cueAt, parseDirectives } from '@/lib/ai/directives';
import { resolvePersona } from '@/lib/ai/personas';
import { VoicePlayer, primeBrowserVoices } from '@/lib/audio/voice';
import { useMemory } from '@/lib/store/memory-store';
import { usePersonas } from '@/lib/store/persona-store';
import { useSettings } from '@/lib/store/settings-store';
import { useStage } from '@/lib/store/stage-store';
import { useStageApi } from '@/components/live2d/stage-provider';
import type { MiraiUIMessage } from '@/types/chat';
import type { Emotion } from '@/types/emotion';

/**
 * Ties the language model, the face and the voice into one conversation.
 *
 * The part worth reading is `useEffect` on `messages`: emotion cues are fired
 * *during* the stream, as the words that carry them arrive, rather than once
 * at the end. That single detail is most of the difference between a character
 * that feels present and an avatar with a mood badge.
 */
export function useMiraiChat() {
  const stageApi = useStageApi();

  const chatModelId = useSettings((state) => state.chatModelId);
  const personaId = useSettings((state) => state.personaId);
  const voiceEnabled = useSettings((state) => state.voiceEnabled);
  const voiceRate = useSettings((state) => state.voiceRate);

  // Subscribe to the stored array rather than to a derived one: a selector
  // that builds a new array each call re-renders forever under zustand v5.
  const customPersonas = usePersonas((state) => state.custom);
  const facts = useMemory((state) => state.facts);

  const setEmotion = useStage((state) => state.setEmotion);
  const setSpeaking = useStage((state) => state.setSpeaking);

  const persona = useMemo(
    () =>
      customPersonas.find((candidate) => candidate.id === personaId) ??
      resolvePersona(personaId),
    [customPersonas, personaId],
  );

  /**
   * The transport is created once and carries no request context.
   *
   * The obvious alternative — a `body` callback on the transport — has to read
   * the current settings from a ref, because the transport outlives the render
   * that created it. Building the body at call time instead keeps everything
   * in ordinary closures over the current render's values, which is both
   * simpler and the only version React 19 considers legal.
   */
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );

  const requestBody = useCallback(
    () => ({
      modelId: chatModelId,
      personaId: persona.id,
      // Built-ins exist on the server too, so only custom personas need to
      // travel with the request.
      persona: persona.builtIn ? undefined : persona,
      memory: facts,
      localTime: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }),
    [chatModelId, persona, facts],
  );

  // ── voice ─────────────────────────────────────────────────────────────────
  const voiceRef = useRef<VoicePlayer | null>(null);

  useEffect(() => {
    primeBrowserVoices();

    const player = new VoicePlayer({
      onStart: (mode) => {
        setSpeaking(true, mode);
        stageApi.setSpeaking(true);
      },
      onEnd: () => {
        setSpeaking(false);
        stageApi.setSpeaking(false);
      },
    });
    voiceRef.current = player;

    // The amplitude source is a closure over the player rather than the ref,
    // so a teardown mid-utterance cannot leave the stage reading a dead one.
    stageApi.setAmplitudeSource(() => player.amplitude());

    return () => {
      player.stop();
      if (voiceRef.current === player) voiceRef.current = null;
      stageApi.setAmplitudeSource(null);
    };
    // Both dependencies are stable: `stageApi` is memoised for the lifetime of
    // the provider and `setSpeaking` is a zustand action.
  }, [stageApi, setSpeaking]);

  // ── chat ──────────────────────────────────────────────────────────────────
  const chat = useChat<MiraiUIMessage>({
    transport,
    onFinish: ({ message }) => {
      const { text, dominant } = parseDirectives(textOf(message));
      // Settle on the reply's final emotion once the whole thing has landed.
      applyEmotion(dominant, 1);

      if (voiceEnabled && text) {
        void voiceRef.current?.speak(text, {
          voice: persona.voice,
          rate: voiceRate,
        });
      }
    },
    onError: () => {
      applyEmotion('sad', 0.6);
    },
  });

  const { messages, status, sendMessage, stop, regenerate, setMessages } = chat;

  const applyEmotion = useCallback(
    (emotion: Emotion, intensity: number) => {
      setEmotion(emotion, intensity);
      stageApi.setEmotion(emotion, intensity);
    },
    [setEmotion, stageApi],
  );

  // ── stream-time emotion cues ──────────────────────────────────────────────
  /** Cues already dispatched for the message currently streaming. */
  const firedRef = useRef<{ messageId: string; count: number }>({
    messageId: '',
    count: 0,
  });

  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.role !== 'assistant') return;

    const raw = textOf(last);
    if (!raw) return;

    const { cues, text } = parseDirectives(raw);
    if (cues.length === 0) return;

    if (firedRef.current.messageId !== last.id) {
      firedRef.current = { messageId: last.id, count: 0 };
    }

    // Only dispatch cues whose text has actually been revealed, so the face
    // never runs ahead of the words.
    const visible = cueAt(cues, text.length);
    const index = visible ? cues.indexOf(visible) + 1 : 0;
    if (index > firedRef.current.count && visible) {
      firedRef.current.count = index;
      applyEmotion(visible.emotion, visible.intensity);
    }
  }, [messages, applyEmotion]);

  // ── actions ───────────────────────────────────────────────────────────────
  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      // Stop any reply still being spoken — the user has moved on.
      voiceRef.current?.stop();
      stageApi.nod(0.6);
      void sendMessage({ text: trimmed }, { body: requestBody() });
    },
    [sendMessage, stageApi, requestBody],
  );

  const cancel = useCallback(() => {
    voiceRef.current?.stop();
    void stop();
  }, [stop]);

  const clear = useCallback(() => {
    voiceRef.current?.stop();
    setMessages([]);
    firedRef.current = { messageId: '', count: 0 };
    applyEmotion(persona.baseEmotion, 1);
  }, [setMessages, applyEmotion, persona.baseEmotion]);

  const replay = useCallback(
    (message: MiraiUIMessage) => {
      const { text } = parseDirectives(textOf(message));
      if (!text) return;
      void voiceRef.current?.speak(text, {
        voice: persona.voice,
        rate: voiceRate,
      });
    },
    [persona.voice, voiceRate],
  );

  const muteVoice = useCallback(() => voiceRef.current?.stop(), []);

  /** Re-runs the last turn with the *current* model and persona settings. */
  const retry = useCallback(() => {
    voiceRef.current?.stop();
    void regenerate({ body: requestBody() });
  }, [regenerate, requestBody]);

  return {
    messages,
    status,
    error: chat.error,
    persona,
    send,
    cancel,
    clear,
    replay,
    retry,
    muteVoice,
    isBusy: status === 'submitted' || status === 'streaming',
  };
}

/** Concatenates every text part of a message. */
export function textOf(message: MiraiUIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join('');
}
