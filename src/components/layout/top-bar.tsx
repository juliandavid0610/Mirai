'use client';

import { Github, Settings2 } from 'lucide-react';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useStage } from '@/lib/store/stage-store';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';

const REPO_URL = 'https://github.com/juliandavid0610/mirai';

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { capabilities, rehearsal } = useCapabilities();
  const status = useStage((state) => state.status);

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex items-center gap-3">
        {/* The mark is the emotion colour, so the logo breathes with the
            character's mood along with everything else. */}
        <span
          aria-hidden
          className="relative grid size-9 place-items-center rounded-xl bg-[hsl(var(--emotion)/0.16)] ring-1 ring-[hsl(var(--emotion)/0.35)]"
        >
          <span className="size-2.5 rounded-full bg-[hsl(var(--emotion))]" />
          {status === 'ready' && (
            <span className="absolute inset-0 animate-pulse-ring rounded-xl ring-1 ring-[hsl(var(--emotion)/0.5)]" />
          )}
        </span>

        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight text-ink-50">
            Mirai
          </h1>
          <p className="text-[11px] text-ink-600">Live2D AI companion</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 sm:flex">
          {rehearsal ? (
            <Badge tone="warn">Rehearsal</Badge>
          ) : (
            <Badge tone="success">Connected</Badge>
          )}
          {capabilities.speech && <Badge>Neural voice</Badge>}
        </div>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="grid size-10 place-items-center rounded-xl text-ink-400 transition-colors hover:bg-white/8 hover:text-ink-50"
          aria-label="View the source on GitHub"
          title="View the source on GitHub"
        >
          <Github className="size-4" />
        </a>

        <IconButton label="Open settings" onClick={onOpenSettings}>
          <Settings2 className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}
