/**
 * Review Incorrect helpers: where a miss happened, and grouping by domain and section.
 */

export const SOURCE_LABELS = {
  bank: "Question bank",
  challenge: "Challenge Bank",
  mock: "Mock exam",
  drill: "Three-Day Drill",
};
export const SOURCE_TONE = {
  bank: "bg-slate-100 text-slate-700",
  challenge: "bg-indigo-100 text-indigo-800",
  mock: "bg-amber-100 text-amber-900",
  drill: "bg-emerald-100 text-emerald-800",
};

export const accuracyTone = (acc) => (acc === null ? "bg-slate-300" : acc >= 85 ? "bg-emerald-500" : acc >= 70 ? "bg-indigo-500" : acc >= 50 ? "bg-amber-500" : "bg-red-500");

/** Group items by domain, then section, following the order of `breakdown` (weakest first). */
export function groupByDomain(items, breakdown) {
  const order = new Map((breakdown || []).map((d, i) => [d.domainId, i]));
  const sectionOrder = new Map();
  for (const d of breakdown || []) d.sections.forEach((s, i) => sectionOrder.set(`${d.domainId}|${s.sectionId}`, i));
  const domains = new Map();
  for (const item of items) {
    if (!domains.has(item.domainId)) domains.set(item.domainId, new Map());
    const sections = domains.get(item.domainId);
    if (!sections.has(item.sectionId)) sections.set(item.sectionId, []);
    sections.get(item.sectionId).push(item);
  }
  const rank = (m, k) => (m.has(k) ? m.get(k) : Number.MAX_SAFE_INTEGER);
  return [...domains.entries()]
    .sort(([a], [b]) => rank(order, a) - rank(order, b) || a.localeCompare(b))
    .map(([domainId, sections]) => ({
      domainId,
      count: [...sections.values()].reduce((n, list) => n + list.length, 0),
      sections: [...sections.entries()]
        .sort(([a, la], [b, lb]) => rank(sectionOrder, `${domainId}|${a}`) - rank(sectionOrder, `${domainId}|${b}`) || lb.length - la.length)
        .map(([sectionId, list]) => ({ sectionId, items: list })),
    }));
}
