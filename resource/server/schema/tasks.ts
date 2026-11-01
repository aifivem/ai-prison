import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const tasksFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    coords: { x: 0, y: 0, z: 0 },
    seconds: 10,
    minutesOff: 1,
    cooldown: 120,
  },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    coords: { type: "vec3" },
    seconds: { type: "number", min: 3, max: 120, integer: true },
    minutesOff: { type: "number", min: 0, max: 60, integer: true },
    cooldown: { type: "number", min: 0, max: 3600, integer: true },
  },
};

export const tasksTab: TabSpec = {
  id: "tasks",
  file: "tasks",
  icon: "screwdriver-wrench",
  label: "ADMIN_TAB_TASKS",
  desc: "ADMIN_TAB_TASKS_DESC",
  createLabel: "ADMIN_NEW_TASK",
  deleteLabel: "ADMIN_DELETE_TASK",
  deleteDesc: "ADMIN_DELETE_TASK_DESC",
  cards: [
    {
      icon: "screwdriver-wrench",
      title: "ADMIN_C_TASK",
      desc: "ADMIN_C_TASK_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          label: "ADMIN_F_TASK_LABEL",
          placeholder: "ADMIN_P_TASK_LABEL",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_TASK_COORDS",
          hint: "ADMIN_H_TASK_COORDS",
          ground: true,
        },
        {
          widget: "number",
          path: "seconds",
          label: "ADMIN_F_TASK_SECONDS",
          min: 3,
          max: 120,
          unit: "s",
        },
        {
          widget: "number",
          path: "minutesOff",
          label: "ADMIN_F_TASK_MINUTES",
          hint: "ADMIN_H_TASK_MINUTES",
          min: 0,
          max: 60,
          unit: "min",
        },
        {
          widget: "number",
          path: "cooldown",
          label: "ADMIN_F_TASK_COOLDOWN",
          hint: "ADMIN_H_TASK_COOLDOWN",
          min: 0,
          max: 3600,
          unit: "s",
        },
      ],
    },
  ],
};
