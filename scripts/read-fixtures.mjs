// Writes one JSON file per health category, so the phone preview fetches only the granted ones.
import { mkdirSync, writeFileSync } from 'node:fs';

export function writeReadFixtures(data, through, readDir) {
  const { sleep, steps, rhr, hrv, workouts, stride, speed, flights, daylight, exercise } = data;
  const categories = {
    sleep, steps: [...steps].map(([day, sources]) => [day, [...sources]]), rhr: [...rhr], hrv: [...hrv], workouts,
    stride: [...stride], speed: [...speed], flights: [...flights], daylight: [...daylight], exercise: [...exercise],
  };
  mkdirSync(readDir, { recursive: true });
  for (const [name, values] of Object.entries(categories)) {
    writeFileSync(new URL(name + '.json', readDir), JSON.stringify({ through, values }) + '\n');
  }
  return Object.fromEntries(Object.entries(categories).map(([name, values]) => [name, values.length]));
}
