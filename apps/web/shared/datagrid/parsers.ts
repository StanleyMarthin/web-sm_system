export interface SmsReferenceOption {
  value: string;
  label: string;
  code?: string | null;
  aliases?: string[];
}

export type SmsParseResult<T> = { value: T; error?: never } | { value: null; error: string };

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function parseSmsTrimmedText(value: string): SmsParseResult<string> {
  return { value: value.trim() };
}

export function parseSmsNumber(value: string, label = "Angka"): SmsParseResult<number | null> {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return { value: null, error: `${label} tidak valid.` };
  return { value: parsed };
}

export function parseSmsInteger(value: string, label = "Angka"): SmsParseResult<number | null> {
  const parsed = parseSmsNumber(value, label);
  if (parsed.error || parsed.value === null) return parsed;
  if (!Number.isInteger(parsed.value)) return { value: null, error: `${label} harus bilangan bulat.` };
  return { value: parsed.value };
}

export function parseSmsDate(value: string, label = "Tanggal"): SmsParseResult<string | null> {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return { value: trimmed };

  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/u.exec(trimmed);
  if (!match) return { value: null, error: `${label} harus format YYYY-MM-DD atau DD/MM/YYYY.` };

  const [, day, month, year] = match;
  return {
    value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
  };
}

export function parseSmsTime(value: string, label = "Jam"): SmsParseResult<string | null> {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };

  let hour: number;
  let minute: number;

  const colonTime = /^(\d{1,2}):(\d{0,2})$/u.exec(trimmed);
  const compactTime = /^\d{3,4}$/u.test(trimmed);
  const hourOnly = /^(\d{1,2})$/u.exec(trimmed);

  if (colonTime) {
    hour = Number(colonTime[1]);
    minute = colonTime[2] ? Number(colonTime[2]) : 0;
  } else if (compactTime) {
    hour = Number(trimmed.slice(0, -2));
    minute = Number(trimmed.slice(-2));
  } else if (hourOnly) {
    hour = Number(hourOnly[1]);
    minute = 0;
  } else {
    return { value: null, error: `${label} harus format HH:MM atau angka jam.` };
  }

  if (hour > 23 || minute > 59) return { value: null, error: `${label} tidak valid.` };
  return { value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

export function normalizeSmsTimeText(value: string, label = "Jam"): SmsParseResult<string | null> {
  return parseSmsTime(value, label);
}

export function parseSmsDurationMinutes(value: string, label = "Durasi"): SmsParseResult<number | null> {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };

  const hourOnly = /^(\d{1,3})$/u.exec(trimmed);
  if (hourOnly) return { value: Number(hourOnly[1]) * 60 };

  const match = /^(\d{1,3}):(\d{0,2})$/u.exec(trimmed);
  if (!match) return { value: null, error: `${label} harus format HH:MM atau angka jam.` };

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (minute > 59) return { value: null, error: `${label} tidak valid.` };
  return { value: (hour * 60) + minute };
}

export function formatSmsDurationMinutes(value: number) {
  const safeValue = Math.max(0, Math.round(value));
  const hour = Math.floor(safeValue / 60);
  const minute = safeValue % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeSmsDurationText(value: string, label = "Durasi"): SmsParseResult<string | null> {
  const parsed = parseSmsDurationMinutes(value, label);
  if (parsed.error || parsed.value == null) return parsed.error ? { value: null, error: parsed.error } : { value: null };
  return { value: formatSmsDurationMinutes(parsed.value) };
}

export function parseSmsBoolean(value: string): SmsParseResult<boolean> {
  const normalized = normalize(value);
  if (["1", "true", "ya", "yes", "y", "tinggi", "prioritas"].includes(normalized)) return { value: true };
  if (["0", "false", "tidak", "no", "n", "normal"].includes(normalized)) return { value: false };
  return { value: null, error: `Nilai boolean tidak dikenal: ${value}` };
}

export function parseSmsReference(value: string, options: SmsReferenceOption[], label: string): SmsParseResult<string | null> {
  const query = normalize(value);
  if (!query) return { value: null };

  const matches = options.filter((option) => {
    const candidates = [
      option.value,
      option.label,
      option.code ?? "",
      ...(option.aliases ?? []),
    ].map(normalize);
    return candidates.includes(query);
  });

  if (matches.length === 1) return { value: matches[0].value };
  if (matches.length > 1) return { value: null, error: `${label} "${value}" ambigu.` };
  return { value: null, error: `${label} "${value}" tidak ditemukan.` };
}
