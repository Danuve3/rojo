import './styles.css';
import { createRng, randomSeed } from './engine';
import { randomMove } from './ai/random';
import { loadSettings } from './storage/settings';
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
  const rnd = createRng(randomSeed());
  services.bots = () => ({ chooseMove: async (s) => randomMove(s, rnd, 0.8) });
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
