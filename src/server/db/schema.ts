import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  pgTableCreator,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `pg-drizzle_${name}`);

// ============================================================================
// ENUMS - Define stable state types used across the schema
// ============================================================================

export const roleTypeEnum = pgEnum("role_type", [
  "admin",
  "district_manager",
  "farm_owner",
  "farmer",
  "auditor",
]);

export const wellStatusEnum = pgEnum("well_status", [
  "active",
  "inactive",
  "maintenance",
  "offline",
  "restricted",
]);

export const valveStateEnum = pgEnum("valve_state", [
  "open",
  "closed",
  "partially_open",
  "auto",
]);

export const farmStatusEnum = pgEnum("farm_status", [
  "active",
  "inactive",
  "suspended",
  "archived",
]);

export const cropTypeEnum = pgEnum("crop_type", [
  "wheat",
  "rice",
  "corn",
  "cotton",
  "sugarcane",
  "vegetables",
  "fruits",
  "other",
]);

export const growthStageEnum = pgEnum("growth_stage", [
  "germination",
  "vegetative",
  "flowering",
  "fruiting",
  "maturity",
  "harvest",
]);

export const sensorTypeEnum = pgEnum("sensor_type", [
  "water_level",
  "pressure",
  "flow_rate",
  "temperature",
  "humidity",
]);

export const sensorUnitEnum = pgEnum("sensor_unit", [
  "meters",
  "bar",
  "celsius",
  "m3_per_hour",
  "percent",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "threshold_breach",
  "anomaly",
  "sensor_offline",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "critical",
  "warning",
  "info",
]);

export const alertRuleOperatorEnum = pgEnum("alert_rule_operator", [
  "gt",
  "lt",
  "gte",
  "lte",
  "eq",
]);

// ============================================================================
// AUTHENTICATION TABLES (Better Auth managed)
// ============================================================================

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    displayUsername: text("display_username").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("user_email_idx").on(t.email),
    index("user_username_idx").on(t.username),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ============================================================================
// DOMAIN TABLES - Water Management System
// ============================================================================

/**
 * user_profiles: Domain profile extending Better Auth user with national ID,
 * full name, phone, district assignment, and operational flags.
 *
 * Separation of concerns:
 * - Better Auth user table: authentication credentials and sessions
 * - user_profile table: domain identity and district assignment
 */
export const userProfile = pgTable(
  "user_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    nationalId: text("national_id").notNull().unique(),
    fullName: text("full_name").notNull(),
    phoneNumber: text("phone_number"),
    districtId: uuid("district_id"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("user_profile_national_id_idx").on(t.nationalId),
    index("user_profile_district_id_idx").on(t.districtId),
    index("user_profile_is_active_idx").on(t.isActive),
  ],
);

/**
 * roles: Role catalog for RBAC.
 */
export const role = pgTable(
  "role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: roleTypeEnum("type").notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("role_type_idx").on(t.type)],
);

/**
 * user_role_assignments: Many-to-many relationship between users and roles.
 * Tracks who has which role, when assigned, and by whom.
 */
export const userRoleAssignment = pgTable(
  "user_role_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("user_role_assignment_user_idx").on(t.userId),
    index("user_role_assignment_role_idx").on(t.roleId),
    unique("user_role_assignment_unique").on(t.userId, t.roleId),
  ],
);

/**
 * districts: Geographic regions with water management metadata.
 * Stores aquifer and allocation data at the district level.
 */
export const district = pgTable(
  "district",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    boundaryGeojson: jsonb("boundary_geojson"),
    baselineDepthM: numeric("baseline_depth_m", { precision: 10, scale: 2 }),
    annualDepletionRateM: numeric("annual_depletion_rate_m", {
      precision: 10,
      scale: 4,
    }),
    safeYieldM3Yr: numeric("safe_yield_m3_yr", { precision: 15, scale: 2 }),
    warningThresholdPct: numeric("warning_threshold_pct", {
      precision: 5,
      scale: 2,
    }),
    criticalThresholdPct: numeric("critical_threshold_pct", {
      precision: 5,
      scale: 2,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("district_name_idx").on(t.name)],
);

/**
 * wells: Individual water extraction points within districts.
 * Stores well identity, location, capacity, and real-time state.
 */
export const well = pgTable(
  "well",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => district.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    depthM: numeric("depth_m", { precision: 10, scale: 2 }),
    status: wellStatusEnum("status").default("active").notNull(),
    hasSensor: boolean("has_sensor").default(false).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
    baselineFlowRateM3Hr: numeric("baseline_flow_rate_m3_hr", {
      precision: 12,
      scale: 2,
    }),
    maxFlowRateM3Hr: numeric("max_flow_rate_m3_hr", {
      precision: 12,
      scale: 2,
    }),
    currentLevelPct: numeric("current_level_pct", { precision: 5, scale: 2 }),
    valveState: valveStateEnum("valve_state").default("closed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("well_district_id_idx").on(t.districtId),
    index("well_status_idx").on(t.status),
    index("well_location_idx").on(t.latitude, t.longitude),
  ],
);

/**
 * well_status_history: Immutable audit trail of well state transitions.
 * Records who changed what, when, and why.
 */
export const wellStatusHistory = pgTable(
  "well_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "restrict" }),
    changedBy: text("changed_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    fromStatus: wellStatusEnum("from_status"),
    toStatus: wellStatusEnum("to_status").notNull(),
    reason: text("reason"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("well_status_history_well_idx").on(t.wellId),
    index("well_status_history_changed_at_idx").on(t.changedAt),
  ],
);

/**
 * farms: Agricultural entities in districts, assigned to wells.
 * Tracks ownership, water allocation, and operational status.
 */
export const farm = pgTable(
  "farm",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    farmerUserId: text("farmer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    districtId: uuid("district_id")
      .notNull()
      .references(() => district.id, { onDelete: "restrict" }),
    status: farmStatusEnum("status").default("active").notNull(),
    totalAreaAcres: numeric("total_area_acres", { precision: 10, scale: 2 }),
    monthlyQuotaM3: numeric("monthly_quota_m3", { precision: 12, scale: 2 }),
    annualQuotaM3: numeric("annual_quota_m3", { precision: 12, scale: 2 }),
    lastProfileUpdated: timestamp("last_profile_updated", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("farm_owner_idx").on(t.ownerId),
    index("farm_farmer_idx").on(t.farmerUserId),
    index("farm_district_idx").on(t.districtId),
    index("farm_status_idx").on(t.status),
  ],
);

/**
 * farm_wells: Many-to-many relationship between farms and wells.
 * Allows a farm to be supplied by multiple wells with allocation percentages.
 */
export const farmWell = pgTable(
  "farm_well",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farm.id, { onDelete: "cascade" }),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "restrict" }),
    allocationPct: numeric("allocation_pct", {
      precision: 5,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("farm_well_farm_idx").on(t.farmId),
    index("farm_well_well_idx").on(t.wellId),
    unique("farm_well_unique").on(t.farmId, t.wellId),
  ],
);

/**
 * crop_types: Catalog of cultivable crops.
 * Acts as a lookup table for consistent crop classification.
 */
export const cropTypeLookup = pgTable(
  "crop_type_lookup",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: cropTypeEnum("type").notNull().unique(),
    displayName: text("display_name").notNull(),
    commonName: text("common_name"),
    description: text("description"),
  },
  (t) => [index("crop_type_lookup_type_idx").on(t.type)],
);

/**
 * growth_stages: Catalog of crop growth stages.
 * Acts as a lookup table for consistent stage classification.
 */
export const growthStageLookup = pgTable(
  "growth_stage_lookup",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stage: growthStageEnum("stage").notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    estDurationDays: integer("est_duration_days"),
  },
  (t) => [index("growth_stage_lookup_stage_idx").on(t.stage)],
);

/**
 * crop_profiles: Current crop profile for a farm.
 * Represents the active crop, growth stage, and soil moisture target.
 * One profile per farm; updated when crops change or grow.
 */
export const cropProfile = pgTable(
  "crop_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .unique()
      .references(() => farm.id, { onDelete: "cascade" }),
    cropType: cropTypeEnum("crop_type").notNull(),
    growthStage: growthStageEnum("growth_stage").notNull(),
    targetSoilMoisturePct: numeric("target_soil_moisture_pct", {
      precision: 5,
      scale: 2,
    }),
    plantedDate: timestamp("planted_date", { withTimezone: true }),
    expectedHarvestDate: timestamp("expected_harvest_date", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("crop_profile_farm_idx").on(t.farmId),
    index("crop_profile_crop_type_idx").on(t.cropType),
  ],
);

/**
 * crop_history: Historical record of crop profiles.
 * Immutable log of crop changes for auditability and trend analysis.
 */
export const cropHistory = pgTable(
  "crop_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farm.id, { onDelete: "restrict" }),
    cropType: cropTypeEnum("crop_type").notNull(),
    growthStage: growthStageEnum("growth_stage").notNull(),
    targetSoilMoisturePct: numeric("target_soil_moisture_pct", {
      precision: 5,
      scale: 2,
    }),
    plantedDate: timestamp("planted_date", { withTimezone: true }),
    harvestedDate: timestamp("harvested_date", { withTimezone: true }),
    yield: numeric("yield", { precision: 10, scale: 2 }),
    yieldUnit: text("yield_unit").default("kg_per_acre"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("crop_history_farm_idx").on(t.farmId),
    index("crop_history_recorded_at_idx").on(t.recordedAt),
  ],
);

/**
 * sensors: Device registry per well.
 * Stores sensor identity, type, unit, and operational activation state.
 */
export const sensors = pgTable(
  "sensors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "restrict" }),
    type: sensorTypeEnum("type").notNull(),
    unit: sensorUnitEnum("unit").notNull(),
    name: text("name"),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("sensors_well_id_idx").on(t.wellId),
    index("sensors_type_idx").on(t.type),
    index("sensors_is_active_idx").on(t.isActive),
  ],
);

/**
 * sensor_data: Time-series ingestion table for sensor readings.
 * Converted to a TimescaleDB hypertable through SQL migration.
 */
export const sensorData = pgTable(
  "sensor_data",
  {
    sensorId: uuid("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("sensor_data_sensor_id_idx").on(t.sensorId),
    index("sensor_data_timestamp_idx").on(t.timestamp),
    unique("sensor_data_sensor_timestamp_key").on(t.sensorId, t.timestamp),
  ],
);

/**
 * alert_rules: DB-driven threshold rules for sensor-based alert triggering.
 * Evaluated on every ingest — no hardcoded thresholds in application code.
 */
export const alertRule = pgTable(
  "alert_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "cascade" }),
    sensorType: sensorTypeEnum("sensor_type").notNull(),
    operator: alertRuleOperatorEnum("operator").notNull(),
    threshold: doublePrecision("threshold").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    suppressionWindowMinutes: integer("suppression_window_minutes")
      .default(15)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("alert_rule_well_id_idx").on(t.wellId),
    index("alert_rule_sensor_type_idx").on(t.sensorType),
    index("alert_rule_is_active_idx").on(t.isActive),
  ],
);

/**
 * latest_sensor_state: Denormalized current-state table for O(1) dashboard reads.
 * Updated via UPSERT on every sensor ingest — eliminates full hypertable scans.
 */
export const latestSensorState = pgTable(
  "latest_sensor_state",
  {
    sensorId: uuid("sensor_id")
      .primaryKey()
      .references(() => sensors.id, { onDelete: "cascade" }),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    unit: sensorUnitEnum("unit").notNull(),
    type: sensorTypeEnum("type").notNull(),
    lastUpdatedAt: timestamp("last_updated_at", {
      withTimezone: true,
    }).notNull(),
  },
  (t) => [
    index("latest_sensor_state_well_id_idx").on(t.wellId),
    index("latest_sensor_state_type_idx").on(t.type),
  ],
);

/**
 * cron_simulation_run: Durable idempotency and observability registry for
 * scheduled simulation runs.
 */
export const cronSimulationRun = pgTable(
  "cron_simulation_run",
  {
    runKey: text("run_key").primaryKey(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    response: jsonb("response"),
    error: text("error"),
  },
  (t) => [
    index("cron_simulation_run_status_started_idx").on(t.status, t.startedAt),
    index("cron_simulation_run_started_idx").on(t.startedAt),
  ],
);

/**
 * api_keys: Hashed credentials for IoT sensor authentication.
 * Raw keys are returned once at creation and never stored in plaintext.
 */
export const apiKey = pgTable(
  "api_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hashedKey: text("hashed_key").notNull().unique(),
    name: text("name").notNull(),
    wellId: uuid("well_id").references(() => well.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("api_key_hashed_key_idx").on(t.hashedKey),
    index("api_key_well_id_idx").on(t.wellId),
    index("api_key_is_active_idx").on(t.isActive),
  ],
);

/**
 * alerts: Sensor-originated operational alerts.
 * Enriched with well reference, severity, and acknowledgement tracking.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sensorId: uuid("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "cascade" }),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "cascade" }),
    alertRuleId: uuid("alert_rule_id").references(() => alertRule.id, {
      onDelete: "set null",
    }),
    type: alertTypeEnum("type").notNull(),
    severity: alertSeverityEnum("severity").default("warning").notNull(),
    message: text("message").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedByUserId: text("acknowledged_by_user_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("alerts_sensor_id_idx").on(t.sensorId),
    index("alerts_well_id_idx").on(t.wellId),
    index("alerts_type_idx").on(t.type),
    index("alerts_severity_idx").on(t.severity),
    index("alerts_created_at_idx").on(t.createdAt),
    index("alerts_acknowledged_at_idx").on(t.acknowledgedAt),
  ],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  profile: many(userProfile),
  roleAssignments: many(userRoleAssignment),
  ownedFarms: many(farm, { relationName: "owner" }),
  operatedFarms: many(farm, { relationName: "farmer" }),
  statusHistoryRecords: many(wellStatusHistory),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const verificationRelations = relations(verification, ({}) => ({}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
  district: one(district, {
    fields: [userProfile.districtId],
    references: [district.id],
  }),
}));

export const roleRelations = relations(role, ({ many }) => ({
  userAssignments: many(userRoleAssignment),
}));

export const userRoleAssignmentRelations = relations(
  userRoleAssignment,
  ({ one }) => ({
    user: one(user, {
      fields: [userRoleAssignment.userId],
      references: [user.id],
    }),
    role: one(role, {
      fields: [userRoleAssignment.roleId],
      references: [role.id],
    }),
    assignedByUser: one(user, {
      fields: [userRoleAssignment.assignedBy],
      references: [user.id],
    }),
  }),
);

export const districtRelations = relations(district, ({ many }) => ({
  wells: many(well),
  farms: many(farm),
  userProfiles: many(userProfile),
}));

export const wellRelations = relations(well, ({ one, many }) => ({
  district: one(district, {
    fields: [well.districtId],
    references: [district.id],
  }),
  statusHistory: many(wellStatusHistory),
  farmWells: many(farmWell),
  sensors: many(sensors),
  alertRules: many(alertRule),
  alerts: many(alerts),
  latestSensorStates: many(latestSensorState),
  apiKeys: many(apiKey),
}));

export const sensorsRelations = relations(sensors, ({ one, many }) => ({
  well: one(well, {
    fields: [sensors.wellId],
    references: [well.id],
  }),
  sensorData: many(sensorData),
  alerts: many(alerts),
  latestState: one(latestSensorState, {
    fields: [sensors.id],
    references: [latestSensorState.sensorId],
  }),
}));

export const sensorDataRelations = relations(sensorData, ({ one }) => ({
  sensor: one(sensors, {
    fields: [sensorData.sensorId],
    references: [sensors.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  sensor: one(sensors, {
    fields: [alerts.sensorId],
    references: [sensors.id],
  }),
  well: one(well, {
    fields: [alerts.wellId],
    references: [well.id],
  }),
  alertRule: one(alertRule, {
    fields: [alerts.alertRuleId],
    references: [alertRule.id],
  }),
  acknowledgedByUser: one(user, {
    fields: [alerts.acknowledgedByUserId],
    references: [user.id],
  }),
}));

export const wellStatusHistoryRelations = relations(
  wellStatusHistory,
  ({ one }) => ({
    well: one(well, {
      fields: [wellStatusHistory.wellId],
      references: [well.id],
    }),
    changedByUser: one(user, {
      fields: [wellStatusHistory.changedBy],
      references: [user.id],
    }),
  }),
);

export const farmRelations = relations(farm, ({ one, many }) => ({
  owner: one(user, {
    fields: [farm.ownerId],
    references: [user.id],
    relationName: "owner",
  }),
  farmer: one(user, {
    fields: [farm.farmerUserId],
    references: [user.id],
    relationName: "farmer",
  }),
  district: one(district, {
    fields: [farm.districtId],
    references: [district.id],
  }),
  wells: many(farmWell),
  cropProfile: many(cropProfile),
  cropHistory: many(cropHistory),
}));

export const farmWellRelations = relations(farmWell, ({ one }) => ({
  farm: one(farm, {
    fields: [farmWell.farmId],
    references: [farm.id],
  }),
  well: one(well, {
    fields: [farmWell.wellId],
    references: [well.id],
  }),
}));

export const cropTypeLookupRelations = relations(cropTypeLookup, ({}) => ({}));

export const growthStageLookupRelations = relations(
  growthStageLookup,
  ({}) => ({}),
);

export const cropProfileRelations = relations(cropProfile, ({ one }) => ({
  farm: one(farm, {
    fields: [cropProfile.farmId],
    references: [farm.id],
  }),
}));

export const cropHistoryRelations = relations(cropHistory, ({ one }) => ({
  farm: one(farm, {
    fields: [cropHistory.farmId],
    references: [farm.id],
  }),
}));

export const alertRuleRelations = relations(alertRule, ({ one, many }) => ({
  well: one(well, {
    fields: [alertRule.wellId],
    references: [well.id],
  }),
  createdByUser: one(user, {
    fields: [alertRule.createdByUserId],
    references: [user.id],
  }),
  alerts: many(alerts),
}));

export const latestSensorStateRelations = relations(
  latestSensorState,
  ({ one }) => ({
    sensor: one(sensors, {
      fields: [latestSensorState.sensorId],
      references: [sensors.id],
    }),
    well: one(well, {
      fields: [latestSensorState.wellId],
      references: [well.id],
    }),
  }),
);

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  well: one(well, {
    fields: [apiKey.wellId],
    references: [well.id],
  }),
  createdByUser: one(user, {
    fields: [apiKey.createdByUserId],
    references: [user.id],
  }),
}));
