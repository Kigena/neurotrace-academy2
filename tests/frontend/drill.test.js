import { describe, expect, it } from "vitest";
import { DRILL, SHEETS } from "../../src/data/drill/drillQuestions.js";

describe("Focus Drills question bank", () => {
  it("has 30 questions in each core set, a full ACNS set and unique ids", () => {
    const ids = DRILL.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of ["neuro", "peds", "meds"]) expect(DRILL.filter((q) => q.t === t)).toHaveLength(30);
    expect(DRILL.filter((q) => q.t === "acns").length).toBeGreaterThanOrEqual(60);
  });

  it("gives every question four distinct options, an explanation and a memory aid", () => {
    for (const q of DRILL) {
      expect(q.o, q.id).toHaveLength(4);
      expect(new Set(q.o).size, q.id).toBe(4);
      expect(q.q && q.why && q.mem, q.id).toBeTruthy();
    }
  });

  it("has memory-sheet rows that match their headers", () => {
    for (const [topic, sheets] of Object.entries(SHEETS)) {
      for (const [title, head, rows] of sheets) {
        for (const r of rows) expect(r.length, `${topic}: ${title}`).toBe(head.length);
      }
    }
  });
});

describe("Review Incorrect grouping", () => {
  it("groups misses by domain and section, weakest domain first", async () => {
    const { groupByDomain } = await import("../../src/utils/incorrectGroups.js");
    const item = (questionId, domainId, sectionId) => ({ questionId, domainId, sectionId });
    const breakdown = [
      { domainId: "domain-3", sections: [{ sectionId: "d3-b" }, { sectionId: "d3-a" }] },
      { domainId: "domain-1", sections: [{ sectionId: "d1-a" }] },
    ];
    const g = groupByDomain([item("1", "domain-1", "d1-a"), item("2", "domain-3", "d3-a"), item("3", "domain-3", "d3-b"), item("4", "domain-3", "d3-b")], breakdown);
    expect(g.map((d) => d.domainId)).toEqual(["domain-3", "domain-1"]);
    expect(g[0].count).toBe(3);
    expect(g[0].sections.map((s) => [s.sectionId, s.items.length])).toEqual([["d3-b", 2], ["d3-a", 1]]);
  });
});

describe("ACNS focus set", () => {
  it("covers every part of the ACNS page and does not give the answer away by length", async () => {
    const { ACNS_DRILL } = await import("../../src/data/drill/acnsQuestions.js");
    const sections = new Set(ACNS_DRILL.map((q) => q.sec));
    // Guideline 1, Guidelines 2-3, Guideline 4, Guidelines 5-6 and cEEG, Guideline 7 and terminology, seizures, background
    expect(sections.size).toBe(7);
    const longest = ACNS_DRILL.filter((q) => q.o[0].length > 1.25 * Math.max(...q.o.slice(1).map((o) => o.length)));
    expect(longest.length / ACNS_DRILL.length).toBeLessThan(0.2);
  });
});
