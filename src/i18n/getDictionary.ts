import { es, type Dictionary } from "./dictionaries/es";
import { en } from "./dictionaries/en";

const DICTIONARIES: Record<string, Dictionary> = { es, en };

export function getDictionary(language: string): Dictionary {
  return DICTIONARIES[language] ?? es;
}

export type { Dictionary };
