import {
  addCommand,
  every,
  onCharacter,
  registerExport,
} from "@aicore-fivem/lib/server";
import { CORE } from "@aicore-fivem/shared";
import { Locale } from "common";
import { META } from "common/prison";
import { sentences } from "./sentences";

every(60_000, () => sentences.tick(), { name: "sentences" });
every(10_000, () => sentences.checkEscapes(), { name: "escapes" });

onCharacter({
  loaded: (source) => sentences.load(source),
  unloaded: (source) => sentences.unload(source),
});
// A QB police job (or any script) that writes `injail` jails through here.
on(CORE.metaChangedEvent, (source: number, key: string, value: unknown) => {
  if (key === META.minutes) sentences.external(source, value);
});

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
