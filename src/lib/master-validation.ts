import type { NextRequest } from "next/server";
import { z } from "zod";

export const deleteByIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const deletePartSchema = z.object({
  partId: z.coerce.number().int().positive(),
});

export const companyCreateSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
});

export const companyPatchSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const regionCreateSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
});

export const regionPatchSchema = z.object({
  id: z.number().int().positive(),
  companyId: z.number().int().positive().optional(),
  code: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const estateCreateSchema = z.object({
  regionId: z.number().int().positive(),
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const estatePatchSchema = z.object({
  id: z.number().int().positive(),
  regionId: z.number().int().positive().optional(),
  code: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const estateBatchOrdersSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int().min(0).max(9999),
      })
    )
    .min(1),
});

export const blockCreateSchema = z.object({
  estateId: z.number().int().positive(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
});

export const blockPatchSchema = z.object({
  id: z.number().int().positive(),
  estateId: z.number().int().positive().optional(),
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const pumpTypeCreateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(240).nullable().optional(),
});

export const pumpTypePatchSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(240).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const pumpTypePartCreateSchema = z.object({
  sectionCode: z.string().trim().min(1).max(10),
  sectionName: z.string().trim().min(1).max(80),
  itemNo: z.number().int().min(0),
  partName: z.string().trim().min(1).max(160),
  defaultQty: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(100),
});

export const pumpTypePartPatchSchema = z.object({
  partId: z.number().int().positive(),
  sectionCode: z.string().trim().min(1).max(10).optional(),
  sectionName: z.string().trim().min(1).max(80).optional(),
  itemNo: z.number().int().min(0).optional(),
  partName: z.string().trim().min(1).max(160).optional(),
  defaultQty: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const engineBrandCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const engineBrandPatchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export const issuePresetCreateSchema = z.object({
  label: z.string().trim().min(2).max(80),
  defaultAvailability: z.enum(["ada", "tidak_lengkap", "hilang"]),
  defaultCondition: z.enum(["baik", "rusak"]),
  sortOrder: z.number().int().min(0).default(50),
});

export const issuePresetPatchSchema = z.object({
  id: z.number().int().positive(),
  label: z.string().trim().min(2).max(80).optional(),
  defaultAvailability: z.enum(["ada", "tidak_lengkap", "hilang"]).optional(),
  defaultCondition: z.enum(["baik", "rusak"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export function normalizePumpTypeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function extractDeleteId(
  request: NextRequest,
  key = "id"
): Promise<unknown> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body && typeof body === "object" && body[key] !== undefined) {
    return body[key];
  }
  return request.nextUrl.searchParams.get(key);
}
