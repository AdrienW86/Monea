export type BlockPreset =
  "hour" | "halfday" | "day" | "week" | "weeks" | "month" | "custom";

// Calendar arithmetic on Paris wall-clock fields, independent of browser timezone.
// Conversion to Europe/Paris instants happens only when saving the block.
export function blockPeriod(start: string, preset: BlockPreset) {
  const date = new Date(start + "Z");
  if (Number.isNaN(date.getTime())) throw Error("Choisissez une date valide.");
  const stamp = (d: Date) => d.toISOString().slice(0, 16);
  const end = new Date(date);
  if (preset === "hour") end.setUTCHours(end.getUTCHours() + 1);
  else if (preset === "halfday") {
    date.setUTCHours(9, 0, 0, 0);
    end.setUTCHours(13, 0, 0, 0);
  } else if (preset === "month") {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCHours(0, 0, 0, 0);
  } else if (preset !== "custom") {
    date.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(
      end.getUTCDate() + (preset === "day" ? 1 : preset === "week" ? 7 : 14),
    );
  }
  return { start: stamp(date), end: stamp(end) };
}
