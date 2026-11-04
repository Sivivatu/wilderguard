import { describe, expect, it } from 'vitest';
import {
  BUILD_SLOTS, nearRegionPath, nearestRegionDistance, pathForRegion, pathLengthForRegion, pointOnRegionPath,
} from '../src/region-geometry';

const greenfields = [
  { x: -45, y: 310 }, { x: 175, y: 310 }, { x: 245, y: 250 }, { x: 245, y: 170 },
  { x: 355, y: 170 }, { x: 420, y: 230 }, { x: 420, y: 355 }, { x: 525, y: 390 },
  { x: 620, y: 350 }, { x: 650, y: 235 }, { x: 755, y: 210 }, { x: 805, y: 285 },
  { x: 790, y: 410 }, { x: 895, y: 445 }, { x: 1060, y: 415 },
];
const pads = [
  [305, 275], [165, 205], [365, 425], [550, 285],
  [725, 335], [870, 330], [920, 500], [485, 165],
];

describe('regional battlefield geometry', () => {
  it('preserves the original Greenfields road exactly', () => {
    expect(pathForRegion(0)).toEqual(greenfields);
    expect(pointOnRegionPath(0, 110)).toEqual({ x: 65, y: 310 });
  });

  it('gives all five regions a distinct road within a fair length range', () => {
    const baseLength = pathLengthForRegion(0);
    expect(new Set(Array.from({ length: 5 }, (_, i) => JSON.stringify(pathForRegion(i)))).size).toBe(5);
    for (let region = 0; region < 5; region += 1) {
      expect(pathForRegion(region)[0].x).toBe(-45);
      const path = pathForRegion(region);
      expect(path[path.length - 1]).toEqual({ x: 1060, y: 415 });
      expect(pathLengthForRegion(region)).toBeGreaterThanOrEqual(baseLength * .85);
      expect(pathLengthForRegion(region)).toBeLessThanOrEqual(baseLength * 1.15);
      for (const point of pathForRegion(region)) {
        expect(point.x).toBeGreaterThanOrEqual(-45);
        expect(point.x).toBeLessThanOrEqual(1060);
        expect(point.y).toBeGreaterThanOrEqual(70);
        expect(point.y).toBeLessThanOrEqual(550);
      }
    }
  });

  it('keeps every fixed tower pad clear of the road and close enough to defend it', () => {
    for (let region = 0; region < 5; region += 1) {
      for (const [x, y] of pads) {
        const nearest = pointOnRegionPath(region, nearestRegionDistance(region, x, y));
        const clearance = Math.hypot(nearest.x - x, nearest.y - y);
        expect(clearance, `region ${region}, pad ${x},${y}`).toBeGreaterThanOrEqual(34);
        expect(clearance, `region ${region}, pad ${x},${y}`).toBeLessThanOrEqual(180);
      }
    }
  });

  it('projects a soldier spawn onto a segment rather than a nearby sampling point', () => {
    const distance = nearestRegionDistance(0, 43.125, 330);
    expect(distance).toBeCloseTo(88.125, 8);
    expect(pointOnRegionPath(0, distance)).toEqual({ x: 43.125, y: 310 });
    for (let region = 0; region < 5; region += 1) {
      const roadPoint = pointOnRegionPath(region, pathLengthForRegion(region) * .43);
      const projection = pointOnRegionPath(region, nearestRegionDistance(region, roadPoint.x, roadPoint.y));
      expect(projection.x).toBeCloseTo(roadPoint.x, 8);
      expect(projection.y).toBeCloseTo(roadPoint.y, 8);
    }
  });

  it('uses true distance from the road when reserving scenery space', () => {
    expect(nearRegionPath(0, 40, 330, 21)).toBe(true);
    expect(nearRegionPath(0, 40, 330, 19)).toBe(false);
    expect(nearRegionPath(0, 40, 310, 1)).toBe(true);
    expect(nearRegionPath(0, 40, 310, 0)).toBe(false);
  });

  it('clamps travel at either end and safely handles non-finite inputs', () => {
    for (let region = 0; region < 5; region += 1) {
      const path = pathForRegion(region);
      expect(pointOnRegionPath(region, -500)).toEqual(path[0]);
      expect(pointOnRegionPath(region, NaN)).toEqual(path[0]);
      expect(pointOnRegionPath(region, Infinity)).toEqual(path[path.length - 1]);
      expect(pointOnRegionPath(region, pathLengthForRegion(region) + 10)).toEqual(path[path.length - 1]);
      expect(nearestRegionDistance(region, NaN, 5)).toBe(0);
      expect(nearestRegionDistance(region, 5, Infinity)).toBe(0);
      expect(nearRegionPath(region, Infinity, 5, 20)).toBe(false);
      expect(nearRegionPath(region, 5, 5, NaN)).toBe(false);
    }
  });

  it('falls back to Greenfields for invalid regions and exposes immutable geometry', () => {
    for (const invalid of [-1, 5, 1.5, NaN, Infinity]) expect(pathForRegion(invalid)).toEqual(greenfields);
    expect(Object.isFrozen(pathForRegion(0))).toBe(true);
    expect(Object.isFrozen(pathForRegion(0)[0])).toBe(true);
    expect(BUILD_SLOTS.map(({ x, y }) => [x, y])).toEqual(pads);
    expect(Object.isFrozen(BUILD_SLOTS)).toBe(true);
    expect(BUILD_SLOTS.every(slot => Object.isFrozen(slot))).toBe(true);
    const point = pointOnRegionPath(0, 0);
    point.x = 999;
    expect(pathForRegion(0)[0].x).toBe(-45);
  });
});
