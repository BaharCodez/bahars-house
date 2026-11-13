interface Shelved {
  shelf: string;
}

/** Reads grouped by the shelf they're on: named shelves A–Z, catch-all last. */
export function groupByShelf<T extends Shelved>(reads: T[]) {
  const groups = new Map<string, T[]>();
  for (const read of reads) {
    const name = read.shelf ?? "";
    const list = groups.get(name) ?? [];
    list.push(read);
    groups.set(name, list);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );
}

/** Every named shelf in use, A–Z. */
export function shelfNamesOf(reads: Shelved[]) {
  const names = new Set(reads.map((r) => r.shelf).filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}
