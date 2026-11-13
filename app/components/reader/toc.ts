export interface TocEntry {
  label: string;
  href: string;
  depth: number;
}

interface NavItem {
  label?: string;
  href: string;
  subitems?: NavItem[];
}

export function flattenToc(
  items: NavItem[],
  depth = 0,
  out: TocEntry[] = [],
): TocEntry[] {
  for (const item of items) {
    out.push({ label: (item.label ?? "").trim(), href: item.href, depth });
    if (item.subitems?.length) flattenToc(item.subitems, depth + 1, out);
  }
  return out;
}
