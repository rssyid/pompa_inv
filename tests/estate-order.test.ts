import { describe, expect, it } from "vitest";
import { compareEstateOrder, sortEstatesByOrder } from "@/lib/estate-order";

describe("estate-order", () => {
  it("sorts positive sortOrder values ascending even with gaps", () => {
    const input = [
      { code: "CEN", sortOrder: 11 },
      { code: "EBO", sortOrder: 4 },
      { code: "MER", sortOrder: 1 },
      { code: "MHO", sortOrder: 8 },
      { code: "NAS", sortOrder: 7 },
      { code: "PUL", sortOrder: 10 },
      { code: "TEM", sortOrder: 5 },
    ];

    const sorted = sortEstatesByOrder(input);
    expect(sorted.map((e) => e.code)).toEqual([
      "MER",
      "EBO",
      "TEM",
      "NAS",
      "MHO",
      "PUL",
      "CEN",
    ]);
  });

  it("places zero/unnumbered estates after numbered ones alphabetically", () => {
    const input = [
      { code: "ZAA", sortOrder: 0 },
      { code: "CEN", sortOrder: 11 },
      { code: "AAA", sortOrder: 0 },
      { code: "MER", sortOrder: 1 },
      { code: "BBB", sortOrder: null },
    ];

    const sorted = sortEstatesByOrder(input);
    expect(sorted.map((e) => e.code)).toEqual(["MER", "CEN", "AAA", "BBB", "ZAA"]);
  });

  it("uses estate code alphabetically as tie-breaker when sortOrder is equal", () => {
    const input = [
      { code: "TEM", sortOrder: 5 },
      { code: "EBO", sortOrder: 5 },
      { code: "MER", sortOrder: 5 },
    ];

    const sorted = sortEstatesByOrder(input);
    expect(sorted.map((e) => e.code)).toEqual(["EBO", "MER", "TEM"]);
  });

  it("always places unassigned (null code) last", () => {
    const items = [
      { code: null, sortOrder: 1 },
      { code: "ZZZ", sortOrder: 0 },
      { code: "MER", sortOrder: 2 },
    ];

    const sorted = [...items].sort(compareEstateOrder);
    expect(sorted.map((e) => e.code)).toEqual(["MER", "ZZZ", null]);
  });
});
