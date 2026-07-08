'use client';

import { Eraser, TriangleAlert, VolumeX } from 'lucide-react';
import { useMiraiChat } from '@/hooks/use-mirai-chat';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useStage } from '@/lib/store/stage-store';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { Composer } from './composer';
import { MessageList } from './message-list';

/**
 * The conversation surface.
 *
 * Owns no state of its own — everything comes from `useMiraiChat`, which is
 * also what drives the avatar. Keeping both on one hook is what guarantees the
 * face and the transcript can never disagree about what was said.
 */
export function ChatPanel({ className }: { className?: string }) {
  const {
    messages,
    persona,
    isBusy,
    error,
    send,
    cancel,
    clear,
    replay,
    retry,
    muteVoice,
  } = useMiraiChat();

  const { rehearsal } = useCapabilities();
  const speaking = useStage((state) => state.speaking);

  return (
    <Panel
      weight="strong"
      className={cn('flex min-h-0 flex-col overflow-hidden', className)}
    >
      <PanelHeader
        title={persona.name}
        subtitle={persona.summary}
        actions={
          <>
            {speaking && (
              <IconButton label="Stop speaking" onClick={muteVoice}>
                <VolumeX className="size-4" />
              </IconButton>
            )}
            <IconButton
              label="Clear conversation"
              disabled={messages.length === 0}
              onClick={clear}
            >
              <Eraser className="size-4" />
            </IconButton>
          </>
        }
      />

      {rehearsal && (
        <div className="flex items-start gap-2 border-b border-amber-500/15 bg-amber-500/8 px-5 py-2.5">
          <Badge tone="warn">Rehearsal Mode</Badge>
          <p className="text-[11px] leading-relaxed text-amber-100/70">
            No model key configured — replies are scripted. Everything else is
            live. Add <code className="font-mono">AI_GATEWAY_API_KEY</code> to{' '}
            <code className="font-mono">.env.local</code> to connect a model.
          </p>
        </div>
      )}

      <MessageList
        messages={messages}
        persona={persona}
        streaming={isBusy}
        onReplay={replay}
        onRegenerate={retry}
        onSuggestion={send}
      />

      {error && (
        <div className="flex items-start gap-2 border-t border-red-500/20 bg-red-500/8 px-5 py-2.5">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-red-300" />
          <p className="text-[11px] leading-relaxed text-red-100/80">
            {error.message}
          </p>
        </div>
      )}

      <Composer busy={isBusy} onSend={send} onStop={cancel} />
    </Panel>
  );
}
