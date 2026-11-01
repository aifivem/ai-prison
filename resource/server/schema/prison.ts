import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

const MINUTES = { type: "number", min: 0, max: 600, integer: true } as const;

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    release: { type: "vec4" },
    spawns: {
      type: "list",
      max: 30,
      of: { type: "object", fields: { coords: { type: "vec4" } } },
    },
    zone: { type: "list", of: { type: "vec3" }, min: 3, max: 32 },
    zoneHeight: { type: "number", min: 5, max: 200 },
    maxMinutes: { type: "number", min: 1, max: 10_000, integer: true },
    countOffline: { type: "bool" },
    confiscate: { type: "bool" },
    escapePenalty: MINUTES,
    escapeAlert: { type: "bool" },
    canteen: { type: "vec3" },
    canteenItem: { type: "text", lookup: "item", min: 0, max: 48 },
    canteenCount: { type: "number", min: 1, max: 10, integer: true },
    canteenMinutes: { type: "number", min: 0, max: 240, integer: true },
  },
};

export const prisonTab: TabSpec = {
  id: "prison",
  file: "settings",
  icon: "building-shield",
  label: "ADMIN_TAB_PRISON",
  desc: "ADMIN_TAB_PRISON_DESC",
  cards: [
    {
      icon: "bed",
      title: "ADMIN_C_CELLS",
      desc: "ADMIN_C_CELLS_DESC",
      fields: [
        {
          widget: "list",
          path: "spawns",
          label: "ADMIN_F_SPAWNS",
          addLabel: "ADMIN_ADD_SPAWN",
          max: 30,
          newRow: { coords: { x: 0, y: 0, z: 0, heading: 0 } },
          rows: [
            {
              widget: "point",
              path: "coords",
              label: "ADMIN_F_SPAWN",
              heading: true,
              ground: true,
            },
          ],
        },
        {
          widget: "point",
          path: "release",
          label: "ADMIN_F_RELEASE",
          hint: "ADMIN_H_RELEASE",
          heading: true,
          ground: true,
        },
      ],
    },
    {
      icon: "draw-polygon",
      title: "ADMIN_C_AREA",
      desc: "ADMIN_C_AREA_DESC",
      fields: [
        {
          widget: "zone",
          path: "zone",
          heightPath: "zoneHeight",
          label: "ADMIN_F_ZONE",
          hint: "ADMIN_H_ZONE",
        },
        {
          widget: "number",
          path: "zoneHeight",
          label: "ADMIN_F_ZONE_HEIGHT",
          hint: "ADMIN_H_ZONE_HEIGHT",
          min: 5,
          max: 200,
          unit: "m",
        },
      ],
    },
    {
      icon: "utensils",
      title: "ADMIN_C_CANTEEN",
      desc: "ADMIN_C_CANTEEN_DESC",
      fields: [
        {
          widget: "point",
          path: "canteen",
          label: "ADMIN_F_CANTEEN",
          ground: true,
        },
        {
          widget: "text",
          lookup: "item",
          path: "canteenItem",
          label: "ADMIN_F_CANTEEN_ITEM",
          hint: "ADMIN_H_CANTEEN_ITEM",
          placeholder: "ADMIN_P_CANTEEN_ITEM",
        },
        {
          widget: "number",
          path: "canteenCount",
          label: "ADMIN_F_CANTEEN_COUNT",
          min: 1,
          max: 10,
        },
        {
          widget: "number",
          path: "canteenMinutes",
          label: "ADMIN_F_CANTEEN_MINUTES",
          hint: "ADMIN_H_CANTEEN_MINUTES",
          min: 0,
          max: 240,
          unit: "min",
        },
      ],
    },
  ],
};
