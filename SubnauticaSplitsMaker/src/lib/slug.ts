export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[\"']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "subnautica-splits";
}
