export function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function clampMetric(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function metricPercent(value: number) {
  return `${Math.round(clampMetric(value) * 100)}%`;
}

export function metricBadgeClass(value: number) {
  const score = clampMetric(value);
  if (score >= 0.75) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (score >= 0.55) {
    return "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  if (score >= 0.4) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
