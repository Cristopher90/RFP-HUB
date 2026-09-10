export function formatRfpNumber(number: number): string {
  return `RFP-${number}`;
}

type CurrencyOptions = { locale?: string; currency?: string };
type DateOptions = { locale?: string; timeZone?: string };

export function formatCurrency(value: number, options?: CurrencyOptions) {
  return new Intl.NumberFormat(options?.locale ?? "es-MX", {
    style: "currency",
    currency: options?.currency ?? "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: Date | string, options?: DateOptions) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(options?.locale ?? "es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: options?.timeZone,
  }).format(date);
}

export function formatDateTime(value: Date | string, options?: DateOptions) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(options?.locale ?? "es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: options?.timeZone,
  }).format(date);
}
