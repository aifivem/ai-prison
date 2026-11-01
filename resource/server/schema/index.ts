import type { PanelSchema } from "@aicore-fivem/shared";
import { settingsFile, prisonTab } from "./prison";
import { rulesTab } from "./rules";
import { tasksFile, tasksTab } from "./tasks";

/** ai-prison's panel: the prison (cells, area, release point), the rules and the work spots. */
export const prisonSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "handcuffs",
  files: {
    settings: settingsFile,
    tasks: tasksFile,
  },
  tabs: [prisonTab, rulesTab, tasksTab],
};
