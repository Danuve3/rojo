/**
 * Genera los ejercicios de las lecciones temáticas (5 por tema) con análisis generoso.
 *   npx tsx scripts/genLessons.ts            # todos los temas, uno tras otro
 *   npx tsx scripts/genLessons.ts suelo bonus # solo esos temas (para lanzarlos en paralelo)
 * Cada tema se guarda en scripts/.lessons/<tema>.json y luego se combinan en
 * src/coach/training/lessons-data.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CoachEngine } from '../src/coach/engine';
import { generatePuzzles, type Puzzle, type Theme } from '../src/coach/training/generate';

const THEMES: Theme[] = ['suelo', 'adyacencia', 'bonus', 'denegacion', 'ficha', 'final'];
const PER_THEME = 5;
const dir = fileURLToPath(new URL('./.lessons/', import.meta.url));

async function main(): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const wanted = (process.argv.slice(2) as Theme[]).filter((t) => THEMES.includes(t));
  for (const theme of wanted.length ? wanted : THEMES) {
    const coach = new CoachEngine();
    const t0 = performance.now();
    const found = await generatePuzzles({ seed: 1000 + THEMES.indexOf(theme) * 97, count: PER_THEME, minGap: 0.8, theme, timeMs: 12 * 60_000, analyzeMs: 1000 }, coach);
    writeFileSync(`${dir}${theme}.json`, JSON.stringify(found.sort((a, b) => b.gap - a.gap)));
    console.log(`${theme}: ${found.length} ejercicios en ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  }
  const out: Record<string, Puzzle[]> = {};
  for (const t of THEMES) if (existsSync(`${dir}${t}.json`)) out[t] = JSON.parse(readFileSync(`${dir}${t}.json`, 'utf8'));
  writeFileSync(fileURLToPath(new URL('../src/coach/training/lessons-data.json', import.meta.url)), JSON.stringify(out));
  console.log('lecciones combinadas:', Object.entries(out).map(([t, v]) => `${t}=${v.length}`).join(' '));
}

void main();
