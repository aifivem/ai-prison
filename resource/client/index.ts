import {
  AdminWorld,
  callAction,
  notify,
  onServerEvent,
  player,
  Points,
  radial,
  resourceExport,
} from "@aicore-fivem/lib/client";
import { readVec4, RecordObjects, waitFor } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings, readTask } from "common/prison";

const core = resourceExport("ai-core");
const world = new AdminWorld(["settings", "tasks"]);
const settings = world.view("settings", readSettings);
const FAR = { fallback: "PRISON_ERR_FAR" };
/** Minutes of sentence left, as the server says (0 = free). */
let minutes = 0;
const jailed = () => minutes > 0;

/** Work spots (one record's point rebuilt per panel edit) and the canteen, shown only to jailed players. */
const points = new Points();
new RecordObjects(world, "tasks", readTask, (id, task) => {
  points.add(`task:${id}`, {
    coords: task.coords,
    label: Locale("PRISON_PROMPT_WORK", task.label),
    icon: "screwdriver-wrench",
    canShow: jailed,
    onPressed: () => doWork(id),
  });
  return () => points.remove(`task:${id}`);
});

/** The canteen point follows the settings. */
function placeCanteen(): void {
  points.remove("canteen");
  if (settings.value.canteenItem)
    points.add("canteen", {
      coords: settings.value.canteen,
      label: Locale("PRISON_PROMPT_CANTEEN"),
      icon: "utensils",
      canShow: jailed,
      onPressed: () => eat(),
    });
}
placeCanteen();
world.onChange("settings", placeCanteen);

// The server runs the progress bar and takes the minutes off when it ran out.
async function doWork(id: string): Promise<void> {
  await callAction(EVENTS.workStart, [id], FAR);
}

async function eat(): Promise<void> {
  if (await callAction(EVENTS.canteen, [], FAR))
    notify(Locale("PRISON_CANTEEN_DONE"), "success");
}

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
