import {
  notify,
  onServerEvent,
  player,
  radial,
  resourceExport,
} from "@aicore-fivem/lib/client";
import { readVec4, waitFor } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/prison";
import { points } from "./points";

const core = resourceExport("ai-core");
/** Minutes of sentence left, as the server says (0 = free). */
let minutes = 0;
export const jailed = () => minutes > 0;

onServerEvent(
  EVENTS.state,
  { args: ([m]) => (typeof m === "number" && m >= 0 ? [Math.floor(m)] : null) },
  (left) => {
    const was = minutes;
    minutes = left;
    if (was !== left) {
      points.refresh();
      radial.refresh();
    }
    if (left > 0 && left !== was && (left <= 5 || left % 10 === 0))
      notify(Locale("PRISON_TIME_LEFT", left), "info");
  },
);

// The spawn may still be running when a sentence continues after a login: move once the character stands.
onServerEvent(
  EVENTS.move,
  {
    args: ([raw]) => {
      const to = readVec4(raw);
      return to ? [to] : null;
    },
  },
  async (to) => {
    await waitFor(() => core.IsPlayerLoaded() || undefined, 30_000).catch(
      () => undefined,
    );
    await player.teleport(to, { heading: to.heading });
  },
);

radial.add({
  id: "prison_time",
  label: Locale("PRISON_RADIAL"),
  icon: "clock",
  canShow: jailed,
  onPressed: () => notify(Locale("PRISON_TIME_LEFT", minutes), "info"),
});
