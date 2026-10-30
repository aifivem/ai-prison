import {
  addCommand,
  hasCharacter,
  inventory,
  isNear,
  KeyedCooldowns,
  onCharacter,
  onClientCallback,
  online,
  PendingActions,
  registerExport,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId, readText } from "@aicore-fivem/lib/shared";
import { CORE, type ActionResult } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS, META, type Task } from "common/prison";
import { settings, tasks } from "./content";
import { sentences } from "./sentences";

const REACH = 3;
const guards = [hasCharacter()];
/** Prison work in progress (token, 80% of the time, freed on drop and character switch). */
const work = new PendingActions<Task>();
/** Work spots and the canteen by character, so a reconnect does not reset them. */
const cooldowns = new KeyedCooldowns<string>();

onCharacter({
  loaded: (source) => sentences.load(source),
  unloaded: (source) => sentences.unload(source),
});
// A QB police job (or any script) that writes `injail` jails through here.
on(CORE.metaChangedEvent, (source: number, key: string, value: unknown) => {
  if (key === META.minutes) sentences.external(source, value);
});

onClientCallback(
  EVENTS.workStart,
  { args: oneArg((v) => readText(v, 64)), guards, lock: true },
  (source, id): ActionResult<{ token: number; seconds: number }> => {
    const task = tasks.value.get(id);
    const charId = online.character(source)?.id;
    if (!task || charId === undefined || sentences.minutesOf(source) <= 0)
      return fail("PRISON_ERR_NOT_JAILED");
    if (!isNear(source, task.coords, REACH)) return fail("PRISON_ERR_FAR");
    if (!cooldowns.ready(`${charId}:${id}`)) return fail("PRISON_ERR_TIRED");
    return {
      ok: true,
      token: work.start(source, task, task.seconds * 1000),
      seconds: task.seconds,
    };
  },
);

onClientCallback(
  EVENTS.workDone,
  { args: oneArg(readId), guards, lock: true },
  (source, token): ActionResult<{ minutes: number }> => {
    const task = work.take(source, token);
    const charId = online.character(source)?.id;
    if (!task || charId === undefined) return fail("PRISON_ERR_FAR");
    if (!isNear(source, task.coords, REACH + 2)) return fail("PRISON_ERR_FAR");
    cooldowns.start(`${charId}:${task.id}`, task.cooldown * 1000);
    return { ok: true, minutes: sentences.add(source, -task.minutesOff) };
  },
);

onClientCallback(
  EVENTS.canteen,
  (source): ActionResult => {
    const s = settings.value;
    const charId = online.character(source)?.id;
    if (charId === undefined || sentences.minutesOf(source) <= 0)
      return fail("PRISON_ERR_NOT_JAILED");
    if (!s.canteenItem) return fail("PRISON_ERR_CLOSED");
    if (!isNear(source, s.canteen, REACH)) return fail("PRISON_ERR_FAR");
    if (!cooldowns.ready(`${charId}:canteen`)) return fail("PRISON_ERR_TIRED");
    if (!inventory.addItem(source, s.canteenItem, s.canteenCount))
      return fail("PRISON_ERR_FULL");
    cooldowns.start(`${charId}:canteen`, s.canteenMinutes * 60_000);
    return { ok: true };
  },
  { guards, lock: true },
);

// ai-core's prison layer (lib `prison`) calls these; other scripts go through it too.
registerExport(
  "JailPlayer",
  (source: unknown, minutes: unknown, by?: unknown) =>
    typeof source === "number" && typeof minutes === "number"
      ? sentences.jail(source, minutes, typeof by === "number" ? by : 0)
      : false,
);
registerExport("ReleasePlayer", (source: unknown) => {
  if (typeof source !== "number" || sentences.minutesOf(source) <= 0)
    return false;
  sentences.release(source, "released");
  return true;
});
registerExport("GetJailTime", (source: unknown) =>
  typeof source === "number" ? sentences.minutesOf(source) : 0,
);

addCommand(
  "jail",
  {
    help: Locale("COMMAND_JAIL"),
    params: [
      { name: "id", type: "playerId", help: Locale("COMMAND_P_ID") },
      { name: "minutes", type: "number", help: Locale("COMMAND_P_MINUTES") },
    ] as const,
    restricted: true,
  },
  (source, { id, minutes }) => void sentences.jail(id, minutes, source),
);
addCommand(
  "unjail",
  {
    help: Locale("COMMAND_UNJAIL"),
    params: [
      { name: "id", type: "playerId", help: Locale("COMMAND_P_ID") },
    ] as const,
    restricted: true,
  },
  (_source, { id }) => sentences.release(id, "released"),
);
