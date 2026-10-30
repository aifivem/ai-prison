import {
  AdminWorld,
  callAction,
  notify,
  onServerEvent,
  player,
  Points,
  progress,
  radial,
  resourceExport,
} from "@aicore-fivem/lib/client";
import { readVec4, waitFor } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings, readTasks } from "common/prison";

const core = resourceExport("ai-core");
const world = new AdminWorld(["settings", "tasks"]);
const settings = world.view("settings", readSettings);
const tasks = world.view("tasks", readTasks);
const FAR = { fallback: "PRISON_ERR_FAR" };
/** Minutes of sentence left, as the server says (0 = free). */
let minutes = 0;
const jailed = () => minutes > 0;

/** Work spots and the canteen, shown only to jailed players. */
const points = new Points();
function rebuild(): void {
  points.clear();
  for (const task of tasks.value.values())
    points.add(`task:${task.id}`, {
      coords: task.coords,
      label: Locale("PRISON_PROMPT_WORK", task.label),
      icon: "screwdriver-wrench",
      canShow: jailed,
      onPressed: () => doWork(task.id),
    });
  if (settings.value.canteenItem)
    points.add("canteen", {
      coords: settings.value.canteen,
      label: Locale("PRISON_PROMPT_CANTEEN"),
      icon: "utensils",
      canShow: jailed,
      onPressed: () => eat(),
    });
}
rebuild();
world.onChange("settings", rebuild);
world.onChange("tasks", rebuild);

async function doWork(id: string): Promise<void> {
  const started = await callAction(EVENTS.workStart, [id], FAR);
  if (
    !started ||
    typeof started.token !== "number" ||
    typeof started.seconds !== "number"
  )
    return;
  const done = await progress({
    label: Locale("PRISON_WORKING"),
    duration: started.seconds * 1000,
    scenario: "WORLD_HUMAN_HAMMERING",
    disable: { move: true, combat: true },
  });
  if (!done) return;
  const result = await callAction(EVENTS.workDone, [started.token], FAR);
  if (result && typeof result.minutes === "number" && result.minutes > 0)
    notify(Locale("PRISON_WORK_DONE", result.minutes), "success");
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
