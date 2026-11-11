# Rojo

PWA para jugar **sin conexión** a un juego de azulejos (draft de losetas y muro de 5×5) contra **1–3 bots** de dificultad ajustable, con un **modo entrenador** que analiza tus jugadas.

«Rojo» es un nombre parodia: el nombre, el arte (SVG propio de inspiración portuguesa) y la redacción de las reglas son originales.

- Vite + TypeScript estricto, sin framework de UI (DOM y SVG a mano).
- Motor de reglas puro y determinista (RNG mulberry32 con semilla, estado serializable).
- IA y análisis del entrenador en Web Workers; el hilo principal nunca calcula.
- Animaciones con transforms + Web Animations API (FLIP) y sonido sintetizado con Web Audio, sin archivos de audio.
- Persistencia en IndexedDB: partida en curso, historial, ajustes.

## Desarrollo

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173/rojo/
npm test             # tests (Vitest)
npm run typecheck    # tsc --noEmit
npm run build        # build de producción en dist/
npm run preview      # sirve dist/ (el service worker solo funciona aquí, no en dev)
```

## Torneo y calibración

```bash
# Enfrenta cada par de niveles en partidas a 2 jugadores (alternando quién empieza)
npm run tournament -- --levels 1,3,5,7,9 --games 40 --scale 0.25
#   --scale  fracción del presupuesto de MCTS (1 = tiempos reales; ~20 iteraciones/ms)
#   --players 3|4 para mesas más grandes

# Búsqueda por coordenadas de los pesos de evaluación (variante contra base)
npm run calibrate -- --games 200 --level 7

npm run calibrate:coach -- --levels 1,3,5,7,9 --games 1 --budget 1500
npm run bench        # velocidad del MCTS y de los bots heurísticos
```

Los pesos viven en `src/ai/weights.ts` y los parámetros de cada nivel en `src/ai/levels.ts`.

### Resultados de calibración

Torneo 1–10, 24 partidas por pareja, presupuesto de MCTS al 50 % (% de victorias de la fila contra la columna):

```
 nivel     1     2     3     4     5     6     7     8     9    10   total   media
     1     —    33     4     0     0     0     0     0     0     0      4%     5.1
     2    67     —     0     2     0     4     0     0     0     0      8%     9.9
     3    96   100     —    38    29    17    21     0     0     0     33%    35.8
     4   100    98    63     —    54    54    29     0     0     0     44%    51.5
     5   100   100    71    46     —    44    38     0     0     0     44%    54.7
     6   100    96    83    46    56     —    46     0     8     0     48%    53.9
     7   100   100    79    71    63    54     —     0    17     6     54%    63.8
     8   100   100   100   100   100   100   100     —    31    29     84%    50.9
     9   100   100   100   100   100    92    83    69     —    46     88%    52.7
    10   100   100   100   100   100   100    94    71    54     —     91%    54.6
```

El % total de victorias crece con el nivel y los niveles MCTS (8–10) ganan a todos los heurísticos. Entre 4, 5 y 6 las diferencias caen dentro del ruido con 24 partidas; en una tanda específica de 200 partidas por pareja sí salen ordenados (5 gana a 4 el 56 %, 6 a 5 el 56 % y 7 a 6 el 54 %). La «media» es la puntuación media de cada nivel en todo el torneo (baja en los MCTS porque se bloquean mucho entre ellos).

Tras la calibración `puntosInmediatos` pasó a pesar 1,6 y `potencialLinea` 0,45; el resto de variaciones (×0,7 / ×1,4) quedaron dentro del ruido.

### Calibración del entrenador

`npm run calibrate:coach` valora con el entrenador las jugadas de bots de cada nivel. El margen bruto del MCTS exagera las diferencias (los rollouts amplifican las consecuencias de cada jugada): la pérdida media bruta del nivel 7 salía en ~3 puntos por jugada, cuando el margen real de nivel 10 frente a 7 es de 21,6 puntos por partida (~0,6 por jugada; frente a 5, 28 puntos; frente a 3, 48). Por eso el valor se escala por 0,3 (`VALUE_SCALE` en `src/coach/verdict.ts`), con un mínimo: la pérdida nunca es menor que la penalización de suelo evitable, que es segura. Con eso y los umbrales de la especificación (≤0,3 / ≤1 / ≤2,5 / ≤5):

| Nivel | Pérdida media | Precisión | Excelente / Buena / Imprecisión / Error / Pifia |
|---|---|---|---|
| 1 | 2,06 | 46 % | 17 / 29 / 23 / 21 / 10 % |
| 3 | 1,20 | 63 % | 42 / 20 / 22 / 13 / 2 % |
| 5 | 1,07 | 66 % | 47 / 18 / 22 / 9 / 4 % |
| 7 | 1,04 | 65 % | 48 / 23 / 10 / 20 / 0 % |
| 9 | 0,03 | 98 % | 96 / 4 / 0 / 0 / 0 % |

(Una partida por nivel, 1,5 s de análisis por jugada. El nivel 9 sale casi perfecto porque usa el mismo MCTS que el entrenador.) La precisión de una jugada es `100·e^(−pérdida/1,5)` y la de la partida, su media.

## Despliegue

El workflow `.github/workflows/deploy.yml` ejecuta tests, compila y publica `dist/` en GitHub Pages en cada push a `main`. Hay que activarlo una vez en **Settings → Pages → Build and deployment → Source: GitHub Actions**. La app se sirve en `https://<usuario>.github.io/rojo/` (el `base` de Vite es `/rojo/`).

Para regenerar los iconos PNG a partir de `public/favicon.svg`: `npm run icons` (usa Playwright).

## Arquitectura

```
src/
  engine/    reglas puras: estado, jugadas legales, aplicar jugada, alicatado, puntuación
  ai/        factores de evaluación, bots por nivel, MCTS con determinización, cliente del worker
  coach/     análisis, valoración, explicaciones en español, etiquetas de error, resumen
  ui/        pantallas, capa de losetas (nodos reutilizables + FLIP), tableros, gráficas SVG
  audio/     motor Web Audio (compresor, canales) y catálogo de sonidos sintetizados
  storage/   IndexedDB: partida en curso, historial, ajustes
  workers/   entrada del Web Worker de IA y análisis
tests/       motor, factores, entrenador y test de propiedad bot contra bot
scripts/     torneo, calibración, benchmark, iconos
```

### Bots (dificultad 1–10)

| Nivel | Motor | Ruido ε |
|---|---|---|
| 1–2 | Aleatorio con sesgo a no tirar al suelo | — |
| 3–5 | Greedy con la evaluación por factores | 0,40 → 0,20 |
| 6–7 | Greedy + denegación (mejor respuesta de los rivales) | 0,20 → 0,04 |
| 8–10 | MCTS con determinización (la bolsa se baraja en cada simulación), rollouts guiados por la heurística | 0,03 → 0; 200 ms → 1,5 s |

### Entrenador

Analiza siempre con MCTS y presupuesto generoso (1,5 s, ~30 000 simulaciones) en un worker propio, en porciones de 30 ms para poder cancelarse; cachea por posición. El valor de una jugada es el **margen esperado frente al mejor rival**, llevado a puntos con la escala calibrada, y la pérdida es la diferencia con la mejor jugada. Antes de valorar se fuerzan 400 simulaciones de la jugada hecha y de las 3 mejores candidatas, para que la «mejor» no sea una jugada con pocas simulaciones y valor inflado por suerte. Las explicaciones salen de los 2–3 factores con mayor diferencia entre ambas jugadas.

## Decisiones sobre reglas ambiguas

- **Línea llena:** una línea de patrón completa no es un destino válido (aunque sea del mismo color); para tirar losetas a propósito está el suelo.
- **Ficha inicial con el suelo lleno:** quien coge primero del centro se lleva igualmente la ficha (y empieza la ronda siguiente), pero no ocupa hueco ni penaliza.
- **Nadie coge del centro en una ronda:** empieza la siguiente ronda quien empezó la actual.
- **Orden del alicatado:** fila a fila de arriba abajo; con varios jugadores, todos alicatan la misma fila a la vez (el resultado es idéntico a hacerlo jugador a jugador).
- **Marcador:** nunca baja de 0; se recorta tras aplicar el suelo de cada ronda.
- **Sin losetas que repartir:** si al preparar una ronda bolsa y caja están vacías y la mesa queda vacía, la partida termina y se aplican los bonus.
- **Expositores idénticos:** se deduplican en la lista de jugadas legales usando el primero; si tocas un duplicado, la jugada es legal y el entrenador la normaliza al expositor equivalente.
- **Fin de partida:** se comprueba tras el alicatado; el desempate es por filas completas y, si persiste, la victoria es compartida.

## Accesibilidad y rendimiento

- Cada color tiene un símbolo propio (flor, rombo, estrella, anillo, celosía).
- Tocar cerca de una loseta de la mesa la selecciona (radio de 26 px) y tocar una fila del muro equivale a tocar su línea, para ampliar las áreas táctiles en móviles pequeños.
- Respeta `prefers-reduced-motion`; velocidad de animación normal / rápida / instantánea.
- Medido con CPU ×4 (gama media) durante una partida de 4 jugadores: sin long tasks y p95 de 16,8 ms por frame.
