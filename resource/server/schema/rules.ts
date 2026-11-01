import type { TabSpec } from "@aicore-fivem/shared";

export const rulesTab: TabSpec = {
  id: "rules",
  file: "settings",
  icon: "scale-balanced",
  label: "ADMIN_TAB_RULES",
  desc: "ADMIN_TAB_RULES_DESC",
  cards: [
    {
      icon: "gavel",
      title: "ADMIN_C_SENTENCE",
      desc: "ADMIN_C_SENTENCE_DESC",
      fields: [
        {
          widget: "number",
          path: "maxMinutes",
          label: "ADMIN_F_MAX_MINUTES",
          hint: "ADMIN_H_MAX_MINUTES",
          min: 1,
          max: 10_000,
          unit: "min",
        },
        {
          widget: "switch",
          path: "countOffline",
          label: "ADMIN_F_COUNT_OFFLINE",
          hint: "ADMIN_H_COUNT_OFFLINE",
        },
        {
          widget: "switch",
          path: "confiscate",
          label: "ADMIN_F_CONFISCATE",
          hint: "ADMIN_H_CONFISCATE",
        },
      ],
    },
    {
      icon: "person-running",
      title: "ADMIN_C_ESCAPE",
      desc: "ADMIN_C_ESCAPE_DESC",
      fields: [
        {
          widget: "number",
          path: "escapePenalty",
          label: "ADMIN_F_ESCAPE_PENALTY",
          hint: "ADMIN_H_ESCAPE_PENALTY",
          min: 0,
          max: 600,
          unit: "min",
        },
        {
          widget: "switch",
          path: "escapeAlert",
          label: "ADMIN_F_ESCAPE_ALERT",
          hint: "ADMIN_H_ESCAPE_ALERT",
        },
      ],
    },
  ],
};
