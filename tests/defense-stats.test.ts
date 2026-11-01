import { expect, test } from 'vitest';
import { towerStats, meteorDamage } from '../src/game';

test('tower details share the combat values at each upgrade level', () => {
  expect(towerStats('archer', 1)).toEqual({ damage: 15, range: 185, interval: .7 });
  expect(towerStats('cannon', 2)).toEqual({ damage: 59.5, range: 185, interval: 1.65 / 1.15 });
  expect(towerStats('frost', 3)).toEqual({ damage: 19.2, range: 195, interval: .8 / 1.3 });
});

test('Starfall details follow the current region damage', () => {
  expect(meteorDamage(0)).toBe(110);
  expect(meteorDamage(4)).toBe(220);
});
