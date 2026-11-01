import {
  hasCharacter,
  inventory,
  isNear,
  KeyedCooldowns,
  onClientCallback,
  notify,
  online,
  progressFor,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readText } from "@aicore-fivem/lib/shared";
import type { ActionResult } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS, type Task } from "common/prison";
import { settings, tasks } from "./content";
import { sentences } from "./sentences/sentences";

const REACH = 3;
const guards = [hasCharacter()];
/** Work spots and the canteen by character, so a reconnect does not reset them. */
const cooldowns = new KeyedCooldowns<string>();

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
