// Shapes shared by the assistant (server) and the RFP form (client): what the
// assistant can propose while someone edits an RFP. Nothing here is applied by
// the assistant itself — the user presses "Aplicar" in the form.

export const FORM_FIELDS = ["title", "description", "internalNotes", "commodity", "region", "estimatedPrice", "origin"] as const;
export type FormField = (typeof FORM_FIELDS)[number];

export const FORM_QUESTION_TYPES = ["TEXT", "NUMBER", "YES_NO", "SELECT"] as const;

export type FormChange =
  | { kind: "field"; field: FormField; value: string }
  | { kind: "item"; name: string; quantity: number; unit: string; code: string | null; description: string; historicalPrice: number | null }
  | { kind: "question"; text: string; type: (typeof FORM_QUESTION_TYPES)[number]; options: string[]; required: boolean };

export type FormValidationIssue = { severity: "error" | "warning" | "info"; field: string; message: string };

// What the form sends along with each question to the assistant.
export type FormSnapshot = {
  title: string;
  description: string;
  internalNotes: string;
  buyerName: string;
  deadlineAt: string;
  startDate: string;
  commodity: string;
  region: string;
  origin: string;
  estimatedPrice: string;
  items: { name: string; code: string | null; quantity: number; unit: string; historicalPrice: number | null; description: string }[];
  questions: { text: string; type: string; options: string[]; required: boolean; audience: "supplier" | "internal" }[];
  suppliers: { name: string; company: string }[];
};
