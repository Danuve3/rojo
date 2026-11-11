import './styles.css';
import { botProvider, createAiWorker, WorkerClient } from './ai/client';
import { audio } from './audio/engine';
import { CoachClient } from './coach/client';
import { haptic, playSound } from './audio/sounds';
import { getSettings, loadSettings } from './storage/settings';
import { App } from './ui/app';
import { services } from './ui/services';
import { installTileSprite } from './ui/tileArt';
import { endScreen } from './ui/screens/end';
import { gameScreen } from './ui/screens/game';
import { homeScreen } from './ui/screens/home';
import { howtoScreen } from './ui/screens/howto';
import { progressScreen } from './ui/screens/progress';
import { settingsScreen } from './ui/screens/settings';
import { setupScreen } from './ui/screens/setup';

async function boot(): Promise<void> {
  await loadSettings();
  installTileSprite();
  const botWorker = new WorkerClient(createAiWorker);
  services.bots = () => botProvider(botWorker);
  let coachClient: CoachClient | null = null;
  services.coach = () => (coachClient ??= new CoachClient(new WorkerClient(createAiWorker)));
  services.sound = (name, opts) => playSound(name, opts);
  services.haptic = (p) => haptic(p, getSettings().haptics);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  const app = new App(document.getElementById('app') as HTMLElement);
  app.register('home', homeScreen);
  app.register('setup', setupScreen);
  app.register('game', gameScreen);
  app.register('end', endScreen);
  app.register('progress', progressScreen);
  app.register('howto', howtoScreen);
  app.register('settings', settingsScreen);
  app.go('home');
}

void boot();
