import { describe, expect, it } from "vitest";
import { DRILL, SHEETS } from "../../src/data/drill/drillQuestions.js";

describe("Three-Day Drill question bank", () => {
  it("has 30 questions per day with unique ids", () => {
    const ids = DRILL.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of ["neuro", "peds", "meds"]) expect(DRILL.filter((q) => q.t === t)).toHaveLength(30);
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
