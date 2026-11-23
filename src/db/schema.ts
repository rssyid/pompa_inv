import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const regions = pgTable(
  "regions",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("regions_company_code_idx").on(table.companyId, table.code)]
);

export const estates = pgTable(
  "estates",
  {
    id: serial("id").primaryKey(),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("estates_region_code_idx").on(table.regionId, table.code)]
);

export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    estateId: integer("estate_id")
      .notNull()
      .references(() => estates.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blocks_estate_code_idx").on(table.estateId, table.code)]
);

export const pumpTypes = pgTable("pump_types", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pumpTypeParts = pgTable(
  "pump_type_parts",
  {
    id: serial("id").primaryKey(),
    pumpTypeId: integer("pump_type_id")
      .notNull()
      .references(() => pumpTypes.id, { onDelete: "cascade" }),
    sectionCode: text("section_code").notNull(),
    sectionName: text("section_name").notNull(),
    itemNo: integer("item_no").notNull().default(0),
    partName: text("part_name").notNull(),
    defaultQty: integer("default_qty").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("pump_type_parts_type_idx").on(table.pumpTypeId, table.sortOrder)]
);

export const engineBrands = pgTable("engine_brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const issuePresets = pgTable("issue_presets", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().unique(),
  defaultAvailability: text("default_availability").notNull().default("ada"),
  defaultCondition: text("default_condition").notNull().default("baik"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("petugas"),
  defaultEstateId: integer("default_estate_id").references(() => estates.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pumps = pgTable(
  "pumps",
  {
    id: serial("id").primaryKey(),
    pumpCode: text("pump_code").notNull().unique(),
    blockId: integer("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "restrict" }),
    pumpTypeId: integer("pump_type_id")
      .notNull()
      .references(() => pumpTypes.id, { onDelete: "restrict" }),
    engineBrandId: integer("engine_brand_id")
      .notNull()
      .references(() => engineBrands.id, { onDelete: "restrict" }),
    currentUnitStatus: text("current_unit_status").notNull().default("aktif"),
    lastInspectedAt: timestamp("last_inspected_at"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("pumps_block_idx").on(table.blockId),
    index("pumps_status_idx").on(table.currentUnitStatus),
  ]
);

export const inspections = pgTable(
  "inspections",
  {
    id: serial("id").primaryKey(),
    pumpId: integer("pump_id")
      .notNull()
      .references(() => pumps.id, { onDelete: "cascade" }),
    inspectorId: integer("inspector_id").references(() => users.id, {
      onDelete: "set null",
    }),
    inspectorName: text("inspector_name").notNull(),
    inspectedAt: date("inspected_at").notNull(),
    unitStatus: text("unit_status").notNull().default("aktif"),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("inspections_pump_date_idx").on(table.pumpId, table.inspectedAt)]
);

export const inspectionItems = pgTable(
  "inspection_items",
  {
    id: serial("id").primaryKey(),
    inspectionId: integer("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    partId: integer("part_id").references(() => pumpTypeParts.id, {
      onDelete: "set null",
    }),
    sectionCode: text("section_code").notNull(),
    sectionName: text("section_name").notNull(),
    itemNo: integer("item_no").notNull().default(0),
    partName: text("part_name").notNull(),
    expectedQty: integer("expected_qty").notNull().default(1),
    availability: text("availability").notNull().default("ada"),
    condition: text("condition").notNull().default("baik"),
    issuePresetId: integer("issue_preset_id").references(() => issuePresets.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("inspection_items_inspection_idx").on(table.inspectionId),
    index("inspection_items_status_idx").on(table.availability, table.condition),
  ]
);

export const inspectionPhotos = pgTable(
  "inspection_photos",
  {
    id: serial("id").primaryKey(),
    inspectionId: integer("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    storageProvider: text("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    caption: text("caption"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("inspection_photos_inspection_idx").on(table.inspectionId)]
);

export const companiesRelations = relations(companies, ({ many }) => ({
  regions: many(regions),
}));

export const regionsRelations = relations(regions, ({ one, many }) => ({
  company: one(companies, {
    fields: [regions.companyId],
    references: [companies.id],
  }),
  estates: many(estates),
}));

export const estatesRelations = relations(estates, ({ one, many }) => ({
  region: one(regions, {
    fields: [estates.regionId],
    references: [regions.id],
  }),
  blocks: many(blocks),
  users: many(users),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  estate: one(estates, {
    fields: [blocks.estateId],
    references: [estates.id],
  }),
  pumps: many(pumps),
}));

export const pumpTypesRelations = relations(pumpTypes, ({ many }) => ({
  parts: many(pumpTypeParts),
  pumps: many(pumps),
}));

export const pumpTypePartsRelations = relations(pumpTypeParts, ({ one }) => ({
  pumpType: one(pumpTypes, {
    fields: [pumpTypeParts.pumpTypeId],
    references: [pumpTypes.id],
  }),
}));

export const pumpsRelations = relations(pumps, ({ one, many }) => ({
  block: one(blocks, {
    fields: [pumps.blockId],
    references: [blocks.id],
  }),
  pumpType: one(pumpTypes, {
    fields: [pumps.pumpTypeId],
    references: [pumpTypes.id],
  }),
  engineBrand: one(engineBrands, {
    fields: [pumps.engineBrandId],
    references: [engineBrands.id],
  }),
  inspections: many(inspections),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  pump: one(pumps, {
    fields: [inspections.pumpId],
    references: [pumps.id],
  }),
  inspector: one(users, {
    fields: [inspections.inspectorId],
    references: [users.id],
  }),
  items: many(inspectionItems),
  photos: many(inspectionPhotos),
}));

export const inspectionItemsRelations = relations(inspectionItems, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionItems.inspectionId],
    references: [inspections.id],
  }),
  part: one(pumpTypeParts, {
    fields: [inspectionItems.partId],
    references: [pumpTypeParts.id],
  }),
  issuePreset: one(issuePresets, {
    fields: [inspectionItems.issuePresetId],
    references: [issuePresets.id],
  }),
}));

export const inspectionPhotosRelations = relations(inspectionPhotos, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionPhotos.inspectionId],
    references: [inspections.id],
  }),
}));
