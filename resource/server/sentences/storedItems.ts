import { isRecord } from "@aicore-fivem/lib/shared";
import type { ItemMetadata } from "@aicore-fivem/shared";

/** Confiscated items as stored in `jailitems`. */
interface StoredItem {
  name: string;
  count: number;
  metadata: ItemMetadata;
}

export const toItems = (value: unknown): StoredItem[] =>
  Array.isArray(value)
    ? value.flatMap((v) =>
        isRecord(v) && typeof v.name === "string" && typeof v.count === "number"
          ? [
              {
                name: v.name,
                count: v.count,
                metadata: isRecord(v.metadata) ? v.metadata : {},
              },
            ]
          : [],
      )
    : [];
