// Common ISO 4217 currencies covering this app's known clients/suppliers
// (Mexico, Spain, US, Argentina, Brazil, UK) — a small curated list is
// proportionate here, unlike timezones which use the full IANA set.
// Shared between the profile page (populates the <select>) and its server
// action (validates against the same list) so they can't drift.
export const CURRENCIES = ["USD", "MXN", "EUR", "ARS", "BRL", "GBP"];
