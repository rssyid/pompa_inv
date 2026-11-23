import { describe, expect, it } from "vitest";
import { getPumpLocationBadgeInfo, isPumpLocationAssigned } from "../src/lib/pump-location";

describe("Pump Location Assignment Rules", () => {
  it("locks operating hour entry when block is null, empty, Tanpa Blok, or Workshop (WSC)", () => {
    expect(isPumpLocationAssigned({ blockId: null, blockCode: null })).toBe(false);
    expect(isPumpLocationAssigned({ blockId: 1, blockCode: "" })).toBe(false);
    expect(isPumpLocationAssigned({ blockId: 1, blockCode: "Tanpa Blok" })).toBe(false);
    expect(isPumpLocationAssigned({ blockId: 2, blockCode: "WSC" })).toBe(false);
    expect(isPumpLocationAssigned({ blockId: 3, blockCode: "WSC KPP" })).toBe(false);
    expect(isPumpLocationAssigned({ blockId: 4, blockCode: "Workshop" })).toBe(false);
  });

  it("allows operating hour entry when assigned to a field block", () => {
    expect(isPumpLocationAssigned({ blockId: 10, blockCode: "73-02" })).toBe(true);
    expect(isPumpLocationAssigned({ blockId: 11, blockCode: "52-09" })).toBe(true);
    expect(
      getPumpLocationBadgeInfo({ blockId: 11, blockCode: "52-09", estateCode: "NGS" })
    ).toEqual({
      assigned: true,
      label: "NGS / 52-09",
      tone: "ok",
    });
  });
});
