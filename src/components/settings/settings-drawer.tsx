'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { CHAT_MODELS } from '@/lib/ai/models';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useSettings } from '@/lib/store/settings-store';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';
import { AvatarPicker } from './avatar-picker';
import { MemoryPanel } from './memory-panel';
import { PersonaPicker } from './persona-picker';

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Every knob in one scrolling sheet.
 *
 * Implemented as a plain fixed panel rather than a `<dialog>` so the avatar
 * stays visible and interactive behind it — half of these settings (motion,
 * expressiveness, rig) are things you want to watch change in real time while
 * you drag the slider.
 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const settings = useSettings();
  const { capabilities, rehearsal } = useCapabilities();

  // Escape closes. Registered only while open so it cannot swallow the key
  // from anything else on the page.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const models = capabilities.models.length > 0 ? capabilities.models : CHAT_MODELS;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        aria-hidden={!open}
        className={cn(
          'glass-strong fixed top-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col',
          'border-l shadow-2xl shadow-black/60 transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-ink-800/70 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-ink-50">
            Settings
          </h2>
          <IconButton label="Close settings" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>

        <div className="scroll-subtle flex-1 space-y-8 overflow-y-auto px-5 py-6">
          <Section
            title="Character"
            description="Who you are talking to and how they behave."
          >
            <PersonaPicker />
          </Section>

          <Section
            title="Model"
            description={
              rehearsal
                ? 'No key configured — replies come from the built-in script.'
                : 'Routed through the Vercel AI Gateway.'
            }
          >
            <Select
              value={settings.chatModelId}
              disabled={rehearsal}
              options={models.map((model) => ({
                value: model.id,
                label: model.label,
                meta: model.vendor,
              }))}
              onChange={(value) => settings.set('chatModelId', value)}
              hint={
                models.find((model) => model.id === settings.chatModelId)?.note
              }
            />
          </Section>

          <Section title="Avatar" description="The Live2D rig on stage.">
            <AvatarPicker />
          </Section>

          <Section
            title="Voice"
            description={
              capabilities.speech
                ? 'Neural speech with amplitude-driven lip sync.'
                : 'Browser speech — the mouth follows an estimated envelope.'
            }
          >
            <Switch
              label="Speak replies aloud"
              checked={settings.voiceEnabled}
              onChange={(value) => settings.set('voiceEnabled', value)}
            />
            <Switch
              label="Send as soon as I stop speaking"
              description="Otherwise the transcript lands in the box for editing."
              checked={settings.autoSendOnVoice}
              onChange={(value) => settings.set('autoSendOnVoice', value)}
            />
            <Slider
              label="Speaking rate"
              min={0.5}
              max={2}
              step={0.05}
              value={settings.voiceRate}
              format={(value) => `${value.toFixed(2)}×`}
              disabled={!settings.voiceEnabled}
              onChange={(value) => settings.set('voiceRate', value)}
            />
          </Section>

          <Section
            title="Performance"
            description="How strongly the character emotes and moves."
          >
            <Slider
              label="Expressiveness"
              value={settings.expressiveness}
              format={(value) => `${Math.round(value * 100)}%`}
              hint="Scales every emotion. At zero the face stays neutral no matter what the model emits."
              onChange={(value) => settings.set('expressiveness', value)}
            />
            <Slider
              label="Idle motion"
              min={0}
              max={2}
              value={settings.idleMotion}
              format={(value) => `${Math.round(value * 100)}%`}
              hint="Secondary sway layered over the rig's own idle animation."
              disabled={settings.reducedMotion}
              onChange={(value) => settings.set('idleMotion', value)}
            />
            <Switch
              label="Follow my pointer"
              description="The character tracks the cursor around the stage."
              checked={settings.followPointer}
              disabled={settings.reducedMotion}
              onChange={(value) => settings.set('followPointer', value)}
            />
            <Switch
              label="Reduce motion"
              description="Stops idle sway and pointer tracking. Lip sync and expressions stay."
              checked={settings.reducedMotion}
              onChange={(value) => settings.set('reducedMotion', value)}
            />
          </Section>

          <Section
            title="Memory"
            description="Facts sent with every message. Stored only on this device."
          >
            <MemoryPanel />
          </Section>

          <Section title="Developer" description="For tuning and debugging.">
            <Switch
              label="Show diagnostics overlay"
              description="Live FPS, emotion, mouth parameter and unmapped rig parameters."
              checked={settings.showDebugOverlay}
              onChange={(value) => settings.set('showDebugOverlay', value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => settings.reset()}
            >
              Reset all settings
            </Button>
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold tracking-widest text-ink-400 uppercase">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
