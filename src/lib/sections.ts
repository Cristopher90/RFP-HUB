export interface Sectionable {
  section: string | null;
}

export interface SectionEntry<T> {
  item: T;
  index: number;
  label: string;
}

export interface SectionGroup<T> {
  name: string | null;
  sectionNumber: number | null;
  entries: SectionEntry<T>[];
}

// Groups a list into consecutive runs sharing the same `section` name,
// numbering named runs as "Sección N" (items inside as "N.1", "N.2"...)
// and items with no section as a continuous flat counter ("1", "2"...).
export function groupBySection<T extends Sectionable>(
  list: T[],
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  let unsectionedCounter = 0;
  let sectionCounter = 0;

  list.forEach((item, index) => {
    const key = item.section && item.section.trim() ? item.section : null;
    const last = groups[groups.length - 1];
    const sameGroup = last && last.name === key;
    if (!sameGroup) {
      if (key !== null) sectionCounter += 1;
      groups.push({
        name: key,
        sectionNumber: key !== null ? sectionCounter : null,
        entries: [],
      });
    }
    const group = groups[groups.length - 1];
    const label =
      group.sectionNumber !== null
        ? `${group.sectionNumber}.${group.entries.length + 1}`
        : `${++unsectionedCounter}`;
    group.entries.push({ item, index, label });
  });

  return groups;
}

export function nextSectionName<T extends Sectionable>(list: T[]): string {
  const namedGroups = groupBySection(list).filter(
    (g) => g.sectionNumber !== null,
  );
  return `Sección ${namedGroups.length + 1}`;
}
