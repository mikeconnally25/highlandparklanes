export type WageredLeaderboardEntry = {
  rank: number;
  userName: string;
  wagered: string;
  wageredAmount: number;
};

export function maskUsername(username: string): string {
  const name = username.trim();
  if (!name) return "";

  if (name.length <= 6) {
    if (name.length === 1) return "*";
    if (name.length === 2) return `${name[0]}*`;
    if (name.length === 3) return `${name[0]}*${name[2]}`;
    return `${name.slice(0, 3)}*${name.slice(-3)}`;
  }

  return `${name.slice(0, 3)}${"*".repeat(name.length - 6)}${name.slice(-3)}`;
}

export type WageredLeaderboardData = {
  entries: WageredLeaderboardEntry[];
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
  updatedAt: string;
};

const DEFAULT_SHEET_ID = "1wPakSQJBBbAQNEQxPVQWdj1uRbY86bRIUCxde_114_g";
const DEFAULT_SHEET_GID = "2077816179";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parsePeriodParts(value: string): { month: number; year: number } | null {
  const match = value.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2})/);
  if (!match) return null;

  return {
    month: MONTHS[match[2]] ?? -1,
    year: 2000 + Number(match[3]),
  };
}

function parsePeriodDate(value: string): number {
  const parts = parsePeriodParts(value);
  if (!parts) return 0;

  const dayMatch = value.trim().match(/^(\d{2})-/);
  const day = dayMatch ? Number(dayMatch[1]) : 1;
  return new Date(parts.year, parts.month, day).getTime();
}

function getCurrentMonthPeriodKey(
  rows: string[][],
  startIndex: number,
  endIndex: number,
  now = new Date(),
): string | null {
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  let latestEnd = 0;
  let latestKey: string | null = null;

  for (const row of rows.slice(1)) {
    const start = startIndex >= 0 ? row[startIndex]?.trim() ?? "" : "";
    const end = endIndex >= 0 ? row[endIndex]?.trim() ?? "" : "";
    if (!start || !end) continue;

    const startParts = parsePeriodParts(start);
    if (
      !startParts ||
      startParts.month !== currentMonth ||
      startParts.year !== currentYear
    ) {
      continue;
    }

    const endTime = parsePeriodDate(end);
    const key = `${start}|${end}`;
    if (endTime >= latestEnd) {
      latestEnd = endTime;
      latestKey = key;
    }
  }

  return latestKey;
}

function formatMonthYear(value: string): string | null {
  const parts = parsePeriodParts(value);
  if (!parts || parts.month < 0) return null;
  return `${MONTH_NAMES[parts.month]} ${parts.year}`;
}

function getSheetUrl(): string {
  const sheetId = process.env.WAGERED_SHEET_ID ?? DEFAULT_SHEET_ID;
  const gid = process.env.WAGERED_SHEET_GID ?? DEFAULT_SHEET_GID;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      if (char === "\r") i += 1;
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function parseWageredAmount(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatWagered(amount: number, original: string): string {
  if (original.trim()) return original.trim();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function fetchWageredLeaderboard(
  limit = 10,
): Promise<WageredLeaderboardData> {
  const res = await fetch(getSheetUrl(), {
    cache: "no-store",
    headers: { Accept: "text/csv" },
  });

  if (!res.ok) {
    throw new Error(`Could not load wagered leaderboard (${res.status})`);
  }

  const csv = await res.text();
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return {
      entries: [],
      periodStart: null,
      periodEnd: null,
      periodLabel: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const userNameIndex = headers.indexOf("user_name");
  const wageredIndex = headers.indexOf("wagered");
  const rankIndex = headers.indexOf("rank");
  const startIndex = headers.indexOf("start_date_utc");
  const endIndex = headers.indexOf("end_date_utc");

  if (userNameIndex < 0 || wageredIndex < 0) {
    throw new Error("Sheet is missing user_name or wagered columns");
  }

  const currentMonthPeriodKey = getCurrentMonthPeriodKey(rows, startIndex, endIndex);

  const parsed = rows
    .slice(1)
    .filter((row) => {
      if (!currentMonthPeriodKey) return false;
      const start = startIndex >= 0 ? row[startIndex]?.trim() ?? "" : "";
      const end = endIndex >= 0 ? row[endIndex]?.trim() ?? "" : "";
      return `${start}|${end}` === currentMonthPeriodKey;
    })
    .map((row) => {
      const userName = row[userNameIndex]?.trim() ?? "";
      const wageredRaw = row[wageredIndex]?.trim() ?? "";
      const wageredAmount = parseWageredAmount(wageredRaw);
      const sheetRank = rankIndex >= 0 ? Number(row[rankIndex]?.trim()) : NaN;

      return {
        userName,
        wagered: formatWagered(wageredAmount, wageredRaw),
        wageredAmount,
        sheetRank: Number.isFinite(sheetRank) ? sheetRank : null,
      };
    })
    .filter((entry) => entry.userName && entry.wageredAmount > 0)
    .sort(
      (a, b) =>
        (a.sheetRank ?? Number.MAX_SAFE_INTEGER) -
          (b.sheetRank ?? Number.MAX_SAFE_INTEGER) ||
        b.wageredAmount - a.wageredAmount,
    )
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      userName: entry.userName,
      wagered: entry.wagered,
      wageredAmount: entry.wageredAmount,
    }));

  const periodRow = rows
    .slice(1)
    .find((row) => {
      if (!currentMonthPeriodKey) return false;
      const start = startIndex >= 0 ? row[startIndex]?.trim() ?? "" : "";
      const end = endIndex >= 0 ? row[endIndex]?.trim() ?? "" : "";
      return `${start}|${end}` === currentMonthPeriodKey;
    });

  const periodStart =
    periodRow && startIndex >= 0 ? periodRow[startIndex]?.trim() || null : null;

  return {
    entries: parsed,
    periodStart,
    periodEnd:
      periodRow && endIndex >= 0 ? periodRow[endIndex]?.trim() || null : null,
    periodLabel: periodStart ? formatMonthYear(periodStart) : null,
    updatedAt: new Date().toISOString(),
  };
}
