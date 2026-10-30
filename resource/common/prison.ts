import {
  int,
  num,
  polyFromCorners,
  readRecords,
  readVec3,
  readVec4,
  record,
  str,
  type Vec3,
  type Vec4,
  type ZoneShape,
} from "@aicore-fivem/lib/shared";

/** ai-prison's contracts and panel content. No natives. */

export const EVENTS = {
  /** Server -> client: (minutes) the sentence left, 0 = free (sent on load, each minute, release). */
  state: "ai-prison:client:state",
  /** Server -> client: (point: Vec4) teleport (into a cell, back inside after an escape, out at release). */
  move: "ai-prison:client:move",
  /** Action (ActionResult): (taskId) starts prison work: `{ token, seconds }`. */
  workStart: "ai-prison:workStart",
  /** Action (ActionResult): (token) the work is done: `{ minutes }` left. */
  workDone: "ai-prison:workDone",
  /** Action (ActionResult): () a meal from the canteen. */
  canteen: "ai-prison:canteen",
} as const;

/** Character metadata keys: QB's `injail` (minutes left; QB scripts read it) and the confiscated items. */
export const META = {
  minutes: "injail",
  items: "jailitems",
  /** Epoch ms of the unload while jailed (time served offline, when the panel counts it). */
  leftAt: "ai:jailLeftAt",
} as const;

export interface Settings {
  release: Vec4;
  spawns: Vec4[];
  /** The prison area: leaving it while jailed is an escape. */
  zone: Extract<ZoneShape, { type: "poly" }> | null;
  maxMinutes: number;
  countOffline: boolean;
  confiscate: boolean;
  escapePenalty: number;
  escapeAlert: boolean;
  canteen: Vec3;
  canteenItem: string;
  canteenCount: number;
  canteenMinutes: number;
}

const BOLINGBROKE_OUT: Vec4 = {
  x: 1848.13,
  y: 2586.05,
  z: 44.67,
  heading: 269.5,
};
const CELL: Vec4 = { x: 1765.67, y: 2565.91, z: 45.56, heading: 1.5 };
const CANTEEN: Vec3 = { x: 1781.53, y: 2557.61, z: 45.67 };

export function readSettings(value: unknown): Settings {
  const v = record(value);
  const spawns = Array.isArray(v.spawns)
    ? v.spawns.flatMap((row) => readVec4(record(row).coords) ?? [])
    : [];
  const corners = Array.isArray(v.zone)
    ? v.zone.flatMap((c) => readVec3(c) ?? [])
    : [];
  return {
    release: readVec4(v.release) ?? BOLINGBROKE_OUT,
    spawns: spawns.length ? spawns : [CELL],
    zone: polyFromCorners(corners, num(v.zoneHeight, 40, 5, 200)),
    maxMinutes: int(v.maxMinutes, 120, 1, 10_000),
    countOffline: v.countOffline === true,
    confiscate: v.confiscate !== false,
    escapePenalty: int(v.escapePenalty, 5, 0, 600),
    escapeAlert: v.escapeAlert !== false,
    canteen: readVec3(v.canteen) ?? CANTEEN,
    canteenItem: str(v.canteenItem, "", 48),
    canteenCount: int(v.canteenCount, 1, 1, 10),
    canteenMinutes: int(v.canteenMinutes, 10, 0, 240),
  };
}

/** Prison work: a spot where a jailed player works for `seconds` and serves `minutesOff` minutes of the sentence. */
export interface Task {
  id: string;
  label: string;
  coords: Vec3;
  seconds: number;
  minutesOff: number;
  /** Seconds before the same player can work at this spot again. */
  cooldown: number;
}

export const readTasks = (value: unknown): Map<string, Task> =>
  readRecords(value, (id, v) => {
    const coords = readVec3(v.coords);
    if (!coords) return null;
    return {
      id,
      label: str(v.label, id, 48),
      coords,
      seconds: int(v.seconds, 10, 3, 120),
      minutesOff: int(v.minutesOff, 1, 0, 60),
      cooldown: int(v.cooldown, 120, 0, 3600),
    };
  });
