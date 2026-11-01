import {
  aiLog,
  coordsOf,
  dispatch,
  inventory,
  mdt,
  notify,
  online,
  PlayerMap,
} from "@aicore-fivem/lib/server";
import { pickRandom, zoneContains } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, META } from "common/prison";
import { core, log, settings } from "../content";
import { toItems } from "./storedItems";

/**
 * Sentences of the loaded characters, counted by the server only: minutes left in ai-core's metadata (QB's
 * `injail`, so QB scripts see it), confiscated items in `jailitems`, one tick a minute, an area check every 10 s.
 */
class Sentences {
  private readonly jailed = new PlayerMap<number>();
  /** True while this resource writes `injail` (its own `metaChanged` is not a third-party jail). */
  private writing = false;

  minutesOf(source: number): number {
    return this.jailed.get(source) ?? 0;
  }

  private store(source: number, minutes: number): void {
    this.writing = true;
    try {
      core.SetMeta(source, META.minutes, minutes);
    } finally {
      this.writing = false;
    }
    if (minutes > 0) this.jailed.set(source, minutes);
    else this.jailed.delete(source);
    emitNet(EVENTS.state, source, minutes);
  }

  private toCell(source: number): void {
    const spawns = settings.value.spawns;
    emitNet(EVENTS.move, source, pickRandom(spawns));
  }

  /** Puts (or keeps) the player in prison for `minutes` (capped by the panel). */
  jail(source: number, minutes: number, by = 0): boolean {
    if (!online.character(source)) return false;
    const total = Math.min(
      Math.max(1, Math.floor(minutes)),
      settings.value.maxMinutes,
    );
    const first = !this.jailed.has(source);
    if (
      first &&
      settings.value.confiscate &&
      !toItems(core.GetMeta(source, META.items)).length
    ) {
      const items = inventory
        .getItems(source)
        .map(({ name, count, metadata }) => ({ name, count, metadata }));
      core.SetMeta(source, META.items, items);
      inventory.clearInventory(source);
    }
    this.store(source, total);
    if (first) this.toCell(source);
    notify(source, Locale("PRISON_JAILED", total), "warning", 8000);
    aiLog("prison", `jailed for ${total} min`, {
      source: by || undefined,
      target: source,
      metadata: { minutes: total },
    });
    mdt.record({
      kind: "jail",
      target: source,
      by: by || undefined,
      title: Locale("PRISON_RECORD_JAIL", total),
      minutes: total,
    });
    return true;
  }

  /** Lets the player out at the release point with the confiscated items. */
  release(source: number, why: "served" | "released"): void {
    if (!this.jailed.has(source)) return;
    this.store(source, 0);
    for (const item of toItems(core.GetMeta(source, META.items)))
      if (!inventory.addItem(source, item.name, item.count, item.metadata))
        log.warn(`could not give back ${item.count} ${item.name} to ${source}`);
    core.SetMeta(source, META.items, null);
    emitNet(EVENTS.move, source, settings.value.release);
    notify(
      source,
      Locale(why === "served" ? "PRISON_SERVED" : "PRISON_RELEASED"),
      "success",
      8000,
    );
    aiLog("prison", why, { target: source });
  }

  /** Changes the sentence (work: minus, escape: plus); reaching 0 lets the player out. */
  add(source: number, delta: number): number {
    const left = this.minutesOf(source) + delta;
    if (left <= 0) {
      this.release(source, "served");
      return 0;
    }
    this.store(source, left);
    return left;
  }

  /** A character comes in: a running sentence continues (time served offline counted when the panel says so). */
  load(source: number): void {
    let minutes = Number(core.GetMeta(source, META.minutes)) || 0;
    const leftAt = Number(core.GetMeta(source, META.leftAt)) || 0;
    if (leftAt) core.SetMeta(source, META.leftAt, null);
    if (minutes <= 0) return;
    if (settings.value.countOffline && leftAt)
      minutes -= Math.floor((Date.now() - leftAt) / 60_000);
    this.jailed.set(source, Math.max(1, minutes));
    if (minutes <= 0) return this.release(source, "served");
    this.store(source, minutes);
    this.toCell(source);
  }

  unload(source: number): void {
    if (!this.jailed.has(source)) return;
    if (settings.value.countOffline)
      core.SetMeta(source, META.leftAt, Date.now());
    this.jailed.delete(source);
  }

  /** Another script set `injail` (a QB police job): the sentence starts here. */
  external(source: number, value: unknown): void {
    if (this.writing) return;
    const minutes = Number(value) || 0;
    if (minutes > 0 && minutes !== this.minutesOf(source))
      this.jail(source, minutes);
    else if (minutes <= 0 && this.jailed.has(source))
      this.release(source, "released");
  }

  tick(): void {
    for (const source of this.jailed.keys()) this.add(source, -1);
  }

  /** Outside the prison area: back to a cell with the penalty, and the police hear of it. */
  checkEscapes(): void {
    const zone = settings.value.zone;
    if (!zone) return;
    for (const source of this.jailed.keys()) {
      const at = coordsOf(source);
      if (!at || zoneContains(zone, at.x, at.y, at.z)) continue;
      const penalty = settings.value.escapePenalty;
      if (penalty > 0) this.add(source, penalty);
      this.toCell(source);
      notify(source, Locale("PRISON_ESCAPE_CAUGHT", penalty), "error", 8000);
      if (settings.value.escapeAlert)
        dispatch.alert({
          code: "10-98",
          title: Locale("ALERT_ESCAPE_TITLE"),
          message: Locale("ALERT_ESCAPE_MESSAGE"),
          coords: at,
          source,
          icon: "person-running",
          priority: "high",
        });
      aiLog("prison", "escape attempt", {
        target: source,
        metadata: { penalty },
      });
    }
  }
}

export const sentences = new Sentences();
