const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatAud(amount: number | null): string {
  if (amount == null) return "no price";
  const formatted = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `A$${formatted}`;
}

export function formatSourceDate(raw: string | null): string {
  if (!raw) return "date unknown";
  const match = raw.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (!match) return raw;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return raw;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function formatOriginal(amount: number, currency: "USD" | "EUR"): string {
  const formatted = amount.toFixed(2);
  return currency === "USD" ? `US$${formatted}` : `€${formatted}`;
}

export function collectorLabel(number: string, printedTotal: number | null): string {
  return printedTotal ? `${number}/${printedTotal}` : number;
}
