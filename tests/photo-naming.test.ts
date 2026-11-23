import { describe, it, expect } from "vitest";
import { buildPumpFolderPath, buildPumpPhotoFileName } from "../src/lib/storage/naming";

describe("Google Drive Photo Naming & Folder Hierarchy", () => {
  it("builds structured folder segments PT / Region / Estate / PumpCode", () => {
    const pathSegments = buildPumpFolderPath({
      companyCode: "THIP",
      regionCode: "R1-W2",
      estateCode: "PUL",
      pumpCode: "R1-AT-37 20''",
    });

    expect(pathSegments).toEqual(["THIP", "R1-W2", "PUL", "R1-AT-37_20''"]);
  });

  it("formats photo filename cleanly with Estate, Block, PumpCode, Date, and Sequence", () => {
    const name = buildPumpPhotoFileName({
      estateCode: "MHO",
      blockCode: "37-09",
      pumpCode: "R1-AS-34",
      inspectedAt: "2026-11-23",
      sequence: 2,
      mimeType: "image/jpeg",
    });

    expect(name).toBe("MHO_37-09_R1-AS-34_2026-11-23_02.jpg");

    const fieldName = buildPumpPhotoFileName({
      estateCode: "NAS",
      blockCode: "WS Central",
      pumpCode: "R1-AD-23",
      inspectedAt: "2026-11-23",
      sequence: 1,
      mimeType: "image/webp",
      timeSuffix: "113520",
    });

    expect(fieldName).toBe("NAS_WS_Central_R1-AD-23_2026-11-23_113520_01.webp");
  });
});
