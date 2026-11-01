import { AdminWorld, callAction, notify } from "@aicore-fivem/lib/client";
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings, readTask } from "common/prison";
import { points } from "./points";
import { jailed } from "./sentence";

const world = new AdminWorld(["settings", "tasks"]);
const settings = world.view("settings", readSettings);
const FAR = { fallback: "PRISON_ERR_FAR" };

/** Work spots: one record's point rebuilt per panel edit. */
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
