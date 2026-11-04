interface Point { x: number; y: number }
interface BuildSlot extends Point { id: number }
interface Segment {
  readonly start: Readonly<Point>;
  readonly end: Readonly<Point>;
  readonly length: number;
  readonly distance: number;
}

export const BUILD_SLOTS: readonly Readonly<BuildSlot>[] = Object.freeze([
  { id: 1, x: 305, y: 275 }, { id: 2, x: 165, y: 205 },
  { id: 3, x: 365, y: 425 }, { id: 4, x: 550, y: 285 },
  { id: 5, x: 725, y: 335 }, { id: 6, x: 870, y: 330 },
  { id: 7, x: 920, y: 500 }, { id: 8, x: 485, y: 165 },
].map(slot => Object.freeze(slot)));

function route(coordinates: readonly (readonly [number, number])[]): readonly Readonly<Point>[] {
  return Object.freeze(coordinates.map(([x, y]) => Object.freeze({ x, y })));
}

const ROUTES = Object.freeze([
  route([
    [-45, 310], [175, 310], [245, 250], [245, 170], [355, 170],
    [420, 230], [420, 355], [525, 390], [620, 350], [650, 235],
    [755, 210], [805, 285], [790, 410], [895, 445], [1060, 415],
  ]),
  route([
    [-45, 180], [80, 180], [100, 310], [240, 370], [295, 470],
    [390, 110], [590, 100], [635, 300], [665, 415], [810, 475],
    [970, 400], [1060, 415],
  ]),
  route([
    [-45, 340], [110, 340], [220, 320], [220, 140], [380, 110],
    [430, 280], [460, 425], [625, 405], [680, 350], [680, 170],
    [810, 145], [935, 235], [965, 360], [1060, 415],
  ]),
  route([
    [-45, 110], [220, 110], [250, 355], [470, 350], [610, 430],
    [625, 195], [755, 125], [950, 180], [945, 385], [1060, 415],
  ]),
  route([
    [-45, 500], [220, 500], [240, 120], [410, 100], [440, 355],
    [640, 435], [805, 410], [1060, 415],
  ]),
]);

const GEOMETRY = Object.freeze(ROUTES.map(path => {
  const segments: Segment[] = path.slice(1).map((end, index) => {
    const start = path[index];
    return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y), distance: 0 };
  });
  const indexed = segments.map((segment, index) => Object.freeze({
    ...segment, distance: segments.slice(0, index).reduce((sum, part) => sum + part.length, 0),
  }));
  return Object.freeze({
    path, segments: Object.freeze(indexed), length: segments.reduce((sum, part) => sum + part.length, 0),
  });
}));

function geometryForRegion(regionIndex: number) {
  const index = Number.isInteger(regionIndex) && regionIndex >= 0 && regionIndex < ROUTES.length ? regionIndex : 0;
  return GEOMETRY[index];
}

export function pathForRegion(regionIndex: number): readonly Readonly<Point>[] {
  return geometryForRegion(regionIndex).path;
}

export function pathLengthForRegion(regionIndex: number): number {
  return geometryForRegion(regionIndex).length;
}

export function pointOnRegionPath(regionIndex: number, distance: number): Point {
  const geometry = geometryForRegion(regionIndex);
  if (Number.isNaN(distance) || distance <= 0) return { ...geometry.path[0] };
  if (distance >= geometry.length) return { ...geometry.path[geometry.path.length - 1] };
  const segment = geometry.segments.find(part => distance <= part.distance + part.length)!;
  const fraction = (distance - segment.distance) / segment.length;
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * fraction,
    y: segment.start.y + (segment.end.y - segment.start.y) * fraction,
  };
}

function projectOnSegment(segment: Segment, x: number, y: number) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const fraction = Math.max(0, Math.min(1,
    ((x - segment.start.x) * dx + (y - segment.start.y) * dy) / (segment.length * segment.length),
  ));
  const offset = Math.hypot(x - segment.start.x - fraction * dx, y - segment.start.y - fraction * dy);
  return { distance: segment.distance + fraction * segment.length, offset };
}

export function nearestRegionDistance(regionIndex: number, x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return geometryForRegion(regionIndex).segments.reduce((nearest, segment) => {
    const candidate = projectOnSegment(segment, x, y);
    return candidate.offset < nearest.offset ? candidate : nearest;
  }, { distance: 0, offset: Infinity }).distance;
}

export function nearRegionPath(regionIndex: number, x: number, y: number, radius: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return false;
  return geometryForRegion(regionIndex).segments.some(segment => projectOnSegment(segment, x, y).offset < radius);
}
