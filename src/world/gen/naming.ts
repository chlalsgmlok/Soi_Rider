import type { Rng } from '../../core/rng';
import type { DistrictDef, RoadName } from './district-types';
import type { LineSpec } from './layout-types';

/** Bangkok-style numbering: odd sois on one side of the parent road, even on the other, rising along it. */
interface Anchor {
  rank: number;
  n: number;
  /** the number belongs to the spawn soi (named explicitly) and must not be reused */
  reserve: boolean;
}

function numberSide(sois: LineSpec[], prefix: RoadName, start: number, anchor: Anchor | null): void {
  const parity = start % 2;
  const minStart = parity === 1 ? 1 : 2;
  let n = anchor ? anchor.n - 2 * anchor.rank : start;
  if (n < minStart) n = minStart;
  for (let i = 0; i < sois.length; i++, n += 2) {
    if (anchor?.reserve && n === anchor.n && i !== anchor.rank) n += 2;
    sois[i].name = `${prefix.soiEn} ${n}`;
    sois[i].nameTh = `${prefix.soiTh} ${n}`;
  }
}

function majorName(line: LineSpec, def: DistrictDef): RoadName {
  const { main, avenue } = def.roads;
  if (line.role === 'main') return main[0];
  if (line.role === 'cross') return line.cls === 'main' ? main[1] : avenue[0];
  if (line.role === 'parallel') return avenue[1];
  return avenue[2];
}

/** Assign English + Thai names to every line: majors from the district table, sois numbered per side. */
export function nameLines(lines: LineSpec[], def: DistrictDef, spawnLine: number, rng: Rng): void {
  const prefixes = new Map<number, RoadName>();
  for (const l of lines) {
    if (l.cls === 'soi') continue;
    const rn = majorName(l, def);
    l.name = rn.en;
    l.nameTh = rn.th;
    prefixes.set(l.id, rn);
  }
  const spawn = def.roads.spawn;
  const spawnSpec = lines[spawnLine];
  const numbered: LineSpec[] = [];
  for (const [parentId, prefix] of prefixes) {
    for (const side of [1, -1]) {
      const sois = lines
        .filter((l) => l.role === 'soi' && l.parent === parentId && l.side === side)
        .sort((a, b) => a.along - b.along);
      if (sois.length === 0) continue;
      const isSpawnParent = spawnSpec?.parent === parentId;
      const odd = isSpawnParent ? (spawnSpec.side === side) === (spawn.number % 2 === 1) : side > 0;
      let anchor: Anchor | null = null;
      if (isSpawnParent) {
        const rank = sois.findIndex((s) => s.id === spawnLine);
        if (rank >= 0) anchor = { rank, n: spawn.number, reserve: true };
        else {
          const near = sois.reduce((b, s, i) => (Math.abs(s.along - spawnSpec.along) < Math.abs(sois[b].along - spawnSpec.along) ? i : b), 0);
          anchor = { rank: near, n: spawn.number + 1, reserve: false };
        }
      }
      numberSide(sois, prefix, odd ? 1 : 2, anchor);
      numbered.push(...sois.filter((s) => s.id !== spawnLine));
    }
  }
  const specials = rng.shuffle([...def.roads.special]);
  const pool = rng.shuffle(numbered.slice());
  const count = Math.min(specials.length, Math.max(1, Math.floor(pool.length / 5)));
  for (let i = 0; i < count && i < pool.length; i++) {
    pool[i].name = specials[i].en;
    pool[i].nameTh = specials[i].th;
  }
  if (spawnSpec) {
    spawnSpec.name = spawn.en;
    spawnSpec.nameTh = spawn.th;
  }
  const branchCount = new Map<number, number>();
  for (const l of lines) {
    if (l.role !== 'link' && l.role !== 'yaek') continue;
    const parent = lines[l.parent];
    const k = (branchCount.get(parent.id) ?? 0) + 1;
    branchCount.set(parent.id, k);
    const numberedName = /\d$/.test(parent.name);
    l.name = numberedName ? `${parent.name}/${k}` : `${parent.name} Yaek ${k}`;
    l.nameTh = /\d$/.test(parent.nameTh) ? `${parent.nameTh}/${k}` : `${parent.nameTh} แยก ${k}`;
  }
}
