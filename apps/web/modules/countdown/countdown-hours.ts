function formatHours(value: number): string {
  return `${value.toFixed(2)} jam`;
}

export function formatActualHours(value: number | null | undefined): string {
  return formatHours(Number(value ?? 0));
}

export function formatBilledHours(value: number | null | undefined): string {
  return value == null ? "Belum ditagihkan" : formatHours(Number(value));
}
