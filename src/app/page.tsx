import { Workspace } from '@/components/layout/workspace';

/**
 * The entire app is one screen.
 *
 * There is no dashboard, no sidebar of conversations and no settings page —
 * a companion you have to navigate to is not a companion. Everything lives
 * behind the character.
 */
export default function Home() {
  return <Workspace />;
}
