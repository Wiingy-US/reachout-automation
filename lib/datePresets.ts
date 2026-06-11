export type DatePreset = "today" | "7days" | "30days" | "all";

export function getDatePreset(preset: DatePreset): { from: string | null; to: string | null } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "today": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to };
    }
    case "7days": {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { from: start.toISOString(), to };
    }
    case "30days": {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { from: start.toISOString(), to };
    }
    case "all":
    default:
      return { from: null, to: null };
  }
}
