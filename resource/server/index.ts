import {
  addCommand,
  hasCharacter,
  inventory,
  isNear,
  KeyedCooldowns,
  onCharacter,
  onClientCallback,
  notify,
  online,
  progressFor,
  registerExport,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readText } from "@aicore-fivem/lib/shared";
import { CORE, type ActionResult } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS, META, type Task } from "common/prison";
import { settings, tasks } from "./content";
import { sentences } from "./sentences";

const REACH = 3;
const guards = [hasCharacter()];
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
  { args: oneArg((v) => readText(v, 64)), guards },
  (source, id): ActionResult => {
    const task = tasks.get(id);
    const charId = online.charId(source);
    if (!task || charId === undefined || sentences.minutesOf(source) <= 0)
      return fail("PRISON_ERR_NOT_JAILED");
    if (!isNear(source, task.coords, REACH)) return fail("PRISON_ERR_FAR");
    if (!cooldowns.ready(`${charId}:${id}`)) return fail("PRISON_ERR_TIRED");
    void work(source, task);
    return { ok: true };
  },
);

/** The work itself: the server-timed bar, then the minutes off if the player is still jailed at the spot. */
async function work(source: number, task: Task): Promise<void> {
  const done = await progressFor(source, {
    label: Locale("PRISON_WORKING"),
    duration: task.seconds * 1000,
    scenario: "WORLD_HUMAN_HAMMERING",
    disable: { move: true, combat: true },
  });
  const charId = online.charId(source);
  if (
    !done ||
    charId === undefined ||
    sentences.minutesOf(source) <= 0 ||
    !isNear(source, task.coords, REACH + 2)
  )
    return;
  cooldowns.start(`${charId}:${task.id}`, task.cooldown * 1000);
  const minutes = sentences.add(source, -task.minutesOff);
  if (minutes > 0)
    notify(source, Locale("PRISON_WORK_DONE", minutes), "success");
}

onClientCallback(
  EVENTS.canteen,
  (source): ActionResult => {
    const s = settings.value;
    const charId = online.charId(source);
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
