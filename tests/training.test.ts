import { describe, expect, it } from 'vitest';
import { rotateToMe } from '../src/coach/training/rotate';
import { grade, isDue, isLearned, newCard } from '../src/coach/training/srs';
import { legalMoves, newGame } from '../src/engine';

const DAY = 86400000;

describe('repetición espaciada', () => {
  it('una tarjeta nueva vuelve al día siguiente', () => {
    const c = newCard('a', newGame(2, 1), { source: 0, color: 0, target: 'floor' }, { source: 0, color: 0, target: 0 }, 3, 'error', [], 0);
    expect(isDue(c, DAY - 1)).toBe(false);
    expect(isDue(c, DAY)).toBe(true);
  });
  it('acertar alarga el intervalo y fallar lo reinicia', () => {
    let c = newCard('a', newGame(2, 1), { source: 0, color: 0, target: 'floor' }, { source: 0, color: 0, target: 0 }, 3, 'error', [], 0);
    c = grade(c, true, 0);
    expect(c.interval).toBe(3);
    c = grade(c, true, 0);
    expect(c.interval).toBeGreaterThan(6);
    c = grade(c, true, 0);
    expect(isLearned(c)).toBe(true);
    c = grade(c, false, 0);
    expect(c.interval).toBe(1);
    expect(c.lapses).toBe(1);
    expect(isLearned(c)).toBe(false);
  });
});

describe('girar la posición', () => {
  it('el jugador que mueve pasa a ser el 0 sin cambiar las jugadas posibles', () => {
    const s = newGame(3, 9, 2);
    s.players[2].score = 17;
    s.players[0].score = 4;
    const r = rotateToMe(s, 2);
    expect(r.current).toBe(0);
    expect(r.players[0].score).toBe(17);
    expect(r.players[1].score).toBe(4);
    expect(r.roundStarter).toBe(0);
    expect(legalMoves(r)).toEqual(legalMoves(s));
  });
});

describe('racha del puzle diario', async () => {
  const { dayBefore, liveStreak, today } = await import('../src/storage/training');
  it('calcula el día anterior, también a fin de mes y de año', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(today(new Date(2026, 10, 5))).toBe('2026-11-05');
  });
  it('la racha sigue viva hoy y ayer, y se pierde después', () => {
    const d = { day: '2026-11-18', puzzles: [], streak: 4, lastSolvedDay: '2026-11-17', difficulty: 2 };
    expect(liveStreak(d, '2026-11-18')).toBe(4);
    expect(liveStreak(d, '2026-11-17')).toBe(4);
    expect(liveStreak(d, '2026-11-19')).toBe(0);
    expect(liveStreak(undefined, '2026-11-19')).toBe(0);
  });
});
