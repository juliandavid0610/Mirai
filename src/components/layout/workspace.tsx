'use client';

import { useState } from 'react';
import { AvatarStage } from '@/components/live2d/avatar-stage';
import { StageProvider } from '@/components/live2d/stage-provider';
import { ChatPanel } from '@/components/chat/chat-panel';
import { SettingsDrawer } from '@/components/settings/settings-drawer';
import { AuroraBackdrop } from './aurora-backdrop';
import { EmotionTheme } from './emotion-theme';
import { TopBar } from './top-bar';

/**
 * The application shell.
 *
 * Two layouts, one tree:
 *
 *  - **Desktop** — the stage takes the left two-thirds and the chat panel sits
 *    beside it, both full height.
 *  - **Mobile** — the stage becomes the upper half and the chat takes the
 *    lower. Overlaying the chat on top of the character was the first attempt
 *    and it was worse: the face is the entire point, and a translucent sheet
 *    covering it defeats the exercise.
 *
 * `StageProvider` wraps both so the chat hook can reach the avatar without the
 * two being nested.
 */
export function Workspace() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <StageProvider>
      <AuroraBackdrop />
      <EmotionTheme />

      <div className="flex h-dvh flex-col">
        <TopBar onOpenSettings={() => setSettingsOpen(true)} />

        <main className="grid min-h-0 flex-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
          <AvatarStage className="min-h-[38dvh] rounded-panel lg:min-h-0" />
          <ChatPanel className="min-h-[46dvh] lg:min-h-0" />
        </main>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </StageProvider>
  );
}
