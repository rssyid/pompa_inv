import { describe, expect, it } from "vitest";
import {
  blockCreateSchema,
  companyPatchSchema,
  deleteByIdSchema,
  deletePartSchema,
  engineBrandPatchSchema,
  estateBatchOrdersSchema,
  estatePatchSchema,
  issuePresetCreateSchema,
  normalizePumpTypeCode,
  pumpTypePartPatchSchema,
  pumpTypePatchSchema,
  regionCreateSchema,
} from "@/lib/master-validation";

describe("master-validation", () => {
  it("normalizes pump type codes to lowercase snake_case", () => {
    expect(normalizePumpTypeCode("  Axial Quad  ")).toBe("axial_quad");
    expect(normalizePumpTypeCode("Ebara   150")).toBe("ebara_150");
  });

  it("validates deleteByIdSchema and deletePartSchema and rejects invalid IDs", () => {
    expect(deleteByIdSchema.safeParse({ id: 5 }).success).toBe(true);
    expect(deleteByIdSchema.safeParse({ id: "12" }).success).toBe(true);
    expect(deleteByIdSchema.safeParse({ id: 0 }).success).toBe(false);
    expect(deleteByIdSchema.safeParse({ id: -3 }).success).toBe(false);
    expect(deleteByIdSchema.safeParse({ id: "abc" }).success).toBe(false);

    expect(deletePartSchema.safeParse({ partId: 7 }).success).toBe(true);
    expect(deletePartSchema.safeParse({ partId: 0 }).success).toBe(false);
  });

  it("validates create and patch schemas across master entities", () => {
    expect(companyPatchSchema.safeParse({ id: 1, code: " thip ", name: "PT THIP" }).success).toBe(
      true
    );
    expect(companyPatchSchema.safeParse({ id: 1, code: "  " }).success).toBe(false);

    expect(regionCreateSchema.safeParse({ companyId: 1, code: "R1", name: "Region 1" }).success).toBe(
      true
    );
    expect(estatePatchSchema.safeParse({ id: 2, sortOrder: 10 }).success).toBe(true);
    expect(estatePatchSchema.safeParse({ id: 2, sortOrder: -1 }).success).toBe(false);

    expect(
      estateBatchOrdersSchema.safeParse({
        orders: [
          { id: 1, sortOrder: 8 },
          { id: 2, sortOrder: 1 },
        ],
      }).success
    ).toBe(true);
    expect(estateBatchOrdersSchema.safeParse({ orders: [] }).success).toBe(false);

    expect(blockCreateSchema.safeParse({ estateId: 1, code: "28-17", name: "28-17" }).success).toBe(
      true
    );

    expect(
      pumpTypePatchSchema.safeParse({
        id: 3,
        code: "axial_double",
        name: "Axial Double",
        description: null,
      }).success
    ).toBe(true);

    expect(
      pumpTypePartPatchSchema.safeParse({
        partId: 10,
        partName: "Impeller",
        defaultQty: 2,
      }).success
    ).toBe(true);

    expect(engineBrandPatchSchema.safeParse({ id: 1, name: "Yanmar" }).success).toBe(true);
    expect(
      issuePresetCreateSchema.safeParse({
        label: "Korosi Berat",
        defaultAvailability: "ada",
        defaultCondition: "rusak",
      }).success
    ).toBe(true);
  });
});
