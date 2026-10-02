/**
 * How compared laps are told apart: a letter and a colour each. Kept out of the client modules,
 * whose exports a server component receives as client references rather than values.
 */
export const LAP_NAMES = ['A', 'B'] as const;
export const LAP_COLORS = ['--color-lap-a', '--color-lap-b'] as const;

/** "A · lap 3" when laps are compared, "Lap 3" for a lap on its own. */
export function lapLabel(index: number, lapNumber: number, compared: boolean): string {
  return compared
    ? `${LAP_NAMES[index] ?? '?'} · lap ${String(lapNumber)}`
    : `Lap ${String(lapNumber)}`;
}
