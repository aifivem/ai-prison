import { AdminPanel, resourceExport } from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { readSettings, readTask } from "common/prison";
import { prisonSchema } from "./schema";

export const log = createLogger(ResourceName);
export const core = resourceExport("ai-core");
export const panel = new AdminPanel(prisonSchema);
/** Panel content, kept current by the panel. */
export const settings = panel.view("settings", readSettings);
export const tasks = panel.records("tasks", readTask);
