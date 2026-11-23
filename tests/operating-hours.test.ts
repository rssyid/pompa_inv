import { describe, expect, it } from "vitest";
import {
  buildMonitoringCellsForPump,
  enumerateMonitoringDates,
  formatPumpTypeShort,
  getMonthBounds,
} from "../src/lib/queries/operating-hours";

describe("Operating Hours Monitoring Matrix Logic", () => {
  it("enumerates dates and detects Sundays accurately", () => {
    const dates = enumerateMonitoringDates("2026-11-12", "2026-11-16");
    expect(dates.map((d) => d.day)).toEqual([12, 13, 14, 15, 16]);
    expect(dates.find((d) => d.day === 15)?.isSunday).toBe(true);
    expect(dates.find((d) => d.day === 16)?.isSunday).toBe(false);
  });

  it("renders hours, standby '-', consecutive R1..Rn breakdown days, and PRE ORDER", () => {
    const dates = enumerateMonitoringDates("2026-11-12", "2026-11-17");

    // Active pump with logs on Nov 13 & Nov 17
    const activeLogs = new Map([
      ["2026-11-13", { operatingHours: 6, dayStatus: "operasi" }],
      ["2026-11-17", { operatingHours: 7.5, dayStatus: "operasi" }],
    ]);
    const activeCells = buildMonitoringCellsForPump({
      dates,
      logsByDate: activeLogs,
      currentUnitStatus: "aktif",
      isPreOrder: false,
      breakdownStartDate: null,
      latestInspectedDate: "2026-11-10",
      todayStr: "2026-11-19",
    });
    expect(activeCells.map((c) => c.value)).toEqual(["-", "6", "-", "-", "-", "7.5"]);

    // Damaged pump starting 2026-09-25 -> Nov 12 is day 49 (R49..R54)
    const brokenCells = buildMonitoringCellsForPump({
      dates,
      logsByDate: new Map(),
      currentUnitStatus: "rusak_total",
      isPreOrder: false,
      breakdownStartDate: "2026-09-25",
      latestInspectedDate: "2026-11-01",
      todayStr: "2026-11-19",
    });
    expect(brokenCells.map((c) => c.value)).toEqual(["R49", "R50", "R51", "R52", "R53", "R54"]);

    // Pre-order damaged pump
    const poCells = buildMonitoringCellsForPump({
      dates,
      logsByDate: new Map(),
      currentUnitStatus: "rusak_total",
      isPreOrder: true,
      breakdownStartDate: "2026-11-01",
      latestInspectedDate: "2026-11-01",
      todayStr: "2026-11-19",
    });
    expect(poCells.every((c) => c.type === "pre_order" && c.value === "PRE ORDER")).toBe(true);
  });

  it("formats pump short type names and month bounds", () => {
    expect(formatPumpTypeShort("Axial Double")).toBe("AXIAL A-D");
    expect(formatPumpTypeShort("Axial Single")).toBe("AXIAL A-S");
    expect(formatPumpTypeShort("Axial Triple")).toBe("AXIAL A-T");
    expect(formatPumpTypeShort("Ebara")).toBe("EBARA");

    const bounds = getMonthBounds("2026-11");
    expect(bounds.monthStart).toBe("2026-11-01");
    expect(bounds.monthEnd).toBe("2026-11-30");
    expect(bounds.monthName).toBe("November");
  });
});
