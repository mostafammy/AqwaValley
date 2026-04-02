import { relations, sql } from "drizzle-orm";
import {
  check,
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

export const quotaPeriodTypeEnum = pgEnum("quota_period_type", [
  "daily",
  "monthly",
]);

export const quotaStateEnum = pgEnum("quota_state", [
  "ok",
  "warning",
  "critical",
  "exceeded",
  "needs_review",
]);

export const quotaTrendDirectionEnum = pgEnum("quota_trend_direction", [
  "increase",
  "decrease",
  "flat",
]);

export const quotaScopeTypeEnum = pgEnum("quota_scope_type", [
  "farm",
  "district",
]);

export const quotaBreachStatusEnum = pgEnum("quota_breach_status", [
  "open",
  "resolved",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "PENDING",
  "ACTIVATED",
  "COMPLETED",
  "CANCELLED",
]);

export const irrigationEventStatusEnum = pgEnum("irrigation_event_status", [
  "REQUESTED",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "DEBIT_PENDING",
  "FAILED",
  "CANCELLED",
]);

export const irrigationDebitStatusEnum = pgEnum("irrigation_debit_status", [
  "PENDING",
  "APPLIED",
  "FAILED",
]);

export const irrigationSimulationRunStatusEnum = pgEnum(
  "irrigation_simulation_run_status",
  ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"],
);

export const irrigationModelModeEnum = pgEnum("irrigation_model_mode", [
  "production",
  "demo",
]);

export const irrigationTelemetrySourceEnum = pgEnum(
  "irrigation_telemetry_source",
  ["REAL", "SIMULATION"],
);

export const forecastRunStatusEnum = pgEnum("forecast_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const forecastScopeTypeEnum = pgEnum("forecast_scope_type", [
  "district",
  "well",
]);

export const forecastTargetTypeEnum = pgEnum("forecast_target_type", [
  "aquifer_level",
  "extraction_vs_safe_yield",
]);

export const forecastRiskLevelEnum = pgEnum("forecast_risk_level", [
  "low",
  "moderate",
  "high",
  "critical",
]);

export const forecastModelApprovalStateEnum = pgEnum(
  "forecast_model_approval_state",
  ["pending_review", "approved", "rejected", "expired", "superseded"],
);

export const forecastTriggerTypeEnum = pgEnum("forecast_trigger_type", [
  "cron",
  "manual",
  "system",
]);

export const forecastLineageUsageTypeEnum = pgEnum(
  "forecast_lineage_usage_type",
  ["train", "validate", "calibrate"],
);

export const irrigationValveAuditStateEnum = pgEnum(
  "irrigation_valve_audit_state",
  ["CLOSED", "OPENING", "OPEN", "CLOSING"],
);

export const quotaOverrideStatusEnum = pgEnum("quota_override_status", [
  "active",
  "revoked",
  "expired",
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
    expectedHarvestDate: timestamp("expected_harvest_date", { withTimezone: true }),
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
    attemptToken: text("attempt_token"),
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
 * aquifer_forecast_run: Durable execution envelope for forecast jobs.
 */
export const aquiferForecastRun = pgTable(
  "aquifer_forecast_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runKey: text("run_key").notNull().unique(),
    triggerType: forecastTriggerTypeEnum("trigger_type").notNull(),
    triggeredBy: text("triggered_by").references(() => user.id, {
      onDelete: "set null",
    }),
    scopeType: forecastScopeTypeEnum("scope_type").notNull(),
    scopeIds: text("scope_ids").array().notNull().default([]),
    status: forecastRunStatusEnum("status").notNull().default("queued"),
    qualityGateStatus: text("quality_gate_status"),
    responseSummary: jsonb("response_summary"),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("aquifer_forecast_run_status_started_idx").on(t.status, t.startedAt),
    index("aquifer_forecast_run_scope_started_idx").on(
      t.scopeType,
      t.startedAt,
    ),
  ],
);

/**
 * aquifer_linear_regression_model: Versioned model artifact metadata.
 */
export const aquiferLinearRegressionModel = pgTable(
  "aquifer_linear_regression_model",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: forecastScopeTypeEnum("scope_type").notNull(),
    scopeId: uuid("scope_id").notNull(),
    targetType: forecastTargetTypeEnum("target_type").notNull(),
    slope: numeric("slope", { precision: 14, scale: 6 }).notNull(),
    intercept: numeric("intercept", { precision: 14, scale: 6 }).notNull(),
    rSquared: numeric("r_squared", { precision: 8, scale: 6 }),
    sampleCount: integer("sample_count").notNull(),
    trainingWindowStart: timestamp("training_window_start", {
      withTimezone: true,
    }).notNull(),
    trainingWindowEnd: timestamp("training_window_end", {
      withTimezone: true,
    }).notNull(),
    dataCompletenessPct: numeric("data_completeness_pct", {
      precision: 7,
      scale: 4,
    }),
    outlierRatioPct: numeric("outlier_ratio_pct", { precision: 7, scale: 4 }),
    approvalState: forecastModelApprovalStateEnum("approval_state")
      .notNull()
      .default("pending_review"),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalExpiresAt: timestamp("approval_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("aquifer_model_scope_target_window_idx").on(
      t.scopeType,
      t.scopeId,
      t.targetType,
      t.trainingWindowEnd,
    ),
    index("aquifer_model_approval_state_idx").on(t.approvalState),
    unique("aquifer_model_scope_target_unique").on(
      t.scopeType,
      t.scopeId,
      t.targetType,
      t.trainingWindowEnd,
    ),
  ],
);

/**
 * aquifer_risk_flag: Persisted risk outputs for horizon and composite flags.
 */
export const aquiferRiskFlag = pgTable(
  "aquifer_risk_flag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: forecastScopeTypeEnum("scope_type").notNull(),
    scopeId: uuid("scope_id").notNull(),
    targetType: forecastTargetTypeEnum("target_type").notNull(),
    flagType: text("flag_type").notNull(),
    riskLevel: forecastRiskLevelEnum("risk_level").notNull(),
    pointForecast: numeric("point_forecast", { precision: 14, scale: 6 }),
    interval80: jsonb("interval_80"),
    interval95: jsonb("interval_95"),
    reasonCodes: jsonb("reason_codes"),
    plausibilityPolicyVersion: text("plausibility_policy_version").notNull(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => aquiferLinearRegressionModel.id, {
        onDelete: "restrict",
      }),
    runId: uuid("run_id")
      .notNull()
      .references(() => aquiferForecastRun.id, {
        onDelete: "cascade",
      }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("aquifer_risk_scope_flag_computed_idx").on(
      t.scopeType,
      t.scopeId,
      t.flagType,
      t.computedAt,
    ),
    index("aquifer_risk_model_idx").on(t.modelVersionId),
  ],
);

/**
 * aquifer_external_reference_observation: External benchmark observations.
 */
export const aquiferExternalReferenceObservation = pgTable(
  "aquifer_external_reference_observation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceSystem: text("source_system").notNull(),
    stationId: text("station_id").notNull(),
    districtId: uuid("district_id").references(() => district.id, {
      onDelete: "set null",
    }),
    wellId: uuid("well_id").references(() => well.id, {
      onDelete: "set null",
    }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    metricType: text("metric_type").notNull(),
    value: numeric("value", { precision: 16, scale: 6 }).notNull(),
    unit: text("unit").notNull(),
    mappingConfidence: numeric("mapping_confidence", {
      precision: 7,
      scale: 4,
    }),
    sourceSnapshotId: text("source_snapshot_id").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("aquifer_ext_ref_observed_idx").on(t.observedAt),
    index("aquifer_ext_ref_district_idx").on(t.districtId),
    index("aquifer_ext_ref_well_idx").on(t.wellId),
  ],
);

/**
 * aquifer_model_reference_observation_link: Lineage links from model to source observations.
 */
export const aquiferModelReferenceObservationLink = pgTable(
  "aquifer_model_reference_observation_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => aquiferLinearRegressionModel.id, {
        onDelete: "cascade",
      }),
    observationId: uuid("observation_id")
      .notNull()
      .references(() => aquiferExternalReferenceObservation.id, {
        onDelete: "cascade",
      }),
    usageType: forecastLineageUsageTypeEnum("usage_type").notNull(),
    weight: numeric("weight", { precision: 10, scale: 6 }),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("aquifer_lineage_unique").on(
      t.modelVersionId,
      t.observationId,
      t.usageType,
    ),
    index("aquifer_lineage_observation_idx").on(t.observationId),
    index("aquifer_lineage_model_idx").on(t.modelVersionId),
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

/**
 * farm_period_consumption_snapshot: Pre-aggregated farm quota decisions by period.
 * Acts as the primary read model for quota status endpoints.
 */
export const farmPeriodConsumptionSnapshot = pgTable(
  "farm_period_consumption_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farm.id, { onDelete: "cascade" }),
    districtId: uuid("district_id")
      .notNull()
      .references(() => district.id, { onDelete: "restrict" }),
    periodType: quotaPeriodTypeEnum("period_type").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    quotaM3: numeric("quota_m3", { precision: 15, scale: 2 }).notNull(),
    consumptionM3: numeric("consumption_m3", {
      precision: 15,
      scale: 2,
    })
      .default("0")
      .notNull(),
    utilizationPct: numeric("utilization_pct", {
      precision: 7,
      scale: 2,
    })
      .default("0")
      .notNull(),
    baselineConsumptionM3: numeric("baseline_consumption_m3", {
      precision: 15,
      scale: 2,
    }),
    trendDirection: quotaTrendDirectionEnum("trend_direction"),
    trendDeltaPct: numeric("trend_delta_pct", {
      precision: 7,
      scale: 2,
    }),
    rawState: quotaStateEnum("raw_state").notNull(),
    effectiveState: quotaStateEnum("effective_state").notNull(),
    dataQualityFlag: text("data_quality_flag"),
    decisionReasons: jsonb("decision_reasons"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("farm_snapshot_farm_period_start_idx").on(t.farmId, t.periodStart),
    index("farm_snapshot_district_period_start_idx").on(
      t.districtId,
      t.periodStart,
    ),
    index("farm_snapshot_effective_state_computed_at_idx").on(
      t.effectiveState,
      t.computedAt,
    ),
    unique("farm_snapshot_unique").on(t.farmId, t.periodType, t.periodStart),
  ],
);

/**
 * district_period_consumption_snapshot: Pre-aggregated district (city in phase 1)
 * quota decisions by period.
 */
export const districtPeriodConsumptionSnapshot = pgTable(
  "district_period_consumption_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => district.id, { onDelete: "cascade" }),
    periodType: quotaPeriodTypeEnum("period_type").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    quotaM3: numeric("quota_m3", { precision: 15, scale: 2 }).notNull(),
    consumptionM3: numeric("consumption_m3", {
      precision: 15,
      scale: 2,
    })
      .default("0")
      .notNull(),
    utilizationPct: numeric("utilization_pct", {
      precision: 7,
      scale: 2,
    })
      .default("0")
      .notNull(),
    baselineConsumptionM3: numeric("baseline_consumption_m3", {
      precision: 15,
      scale: 2,
    }),
    trendDirection: quotaTrendDirectionEnum("trend_direction"),
    trendDeltaPct: numeric("trend_delta_pct", {
      precision: 7,
      scale: 2,
    }),
    rawState: quotaStateEnum("raw_state").notNull(),
    effectiveState: quotaStateEnum("effective_state").notNull(),
    dataQualityFlag: text("data_quality_flag"),
    decisionReasons: jsonb("decision_reasons"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("district_snapshot_period_start_idx").on(t.districtId, t.periodStart),
    index("district_snapshot_effective_state_computed_at_idx").on(
      t.effectiveState,
      t.computedAt,
    ),
    unique("district_snapshot_unique").on(
      t.districtId,
      t.periodType,
      t.periodStart,
    ),
  ],
);

/**
 * quota_breach_event: Immutable record of quota breach detections.
 */
export const quotaBreachEvent = pgTable(
  "quota_breach_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: quotaScopeTypeEnum("scope_type").notNull(),
    farmId: uuid("farm_id").references(() => farm.id, { onDelete: "cascade" }),
    districtId: uuid("district_id")
      .notNull()
      .references(() => district.id, { onDelete: "cascade" }),
    periodType: quotaPeriodTypeEnum("period_type").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    rawState: quotaStateEnum("raw_state").notNull(),
    effectiveState: quotaStateEnum("effective_state").notNull(),
    quotaM3: numeric("quota_m3", { precision: 15, scale: 2 }).notNull(),
    consumptionM3: numeric("consumption_m3", {
      precision: 15,
      scale: 2,
    }).notNull(),
    utilizationPct: numeric("utilization_pct", {
      precision: 7,
      scale: 2,
    }).notNull(),
    deltaM3: numeric("delta_m3", { precision: 15, scale: 2 }).notNull(),
    status: quotaBreachStatusEnum("status").default("open").notNull(),
    reasonCodes: jsonb("reason_codes"),
    message: text("message"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("quota_breach_scope_period_start_idx").on(
      t.scopeType,
      t.periodStart,
      t.periodType,
    ),
    index("quota_breach_farm_idx").on(t.farmId),
    index("quota_breach_district_idx").on(t.districtId),
    index("quota_breach_status_triggered_at_idx").on(t.status, t.triggeredAt),
  ],
);

/**
 * quota_override: Manual override windows that can temporarily adjust effective
 * quota state for farm or district scope.
 */
export const quotaOverride = pgTable(
  "quota_override",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: quotaScopeTypeEnum("scope_type").notNull(),
    farmId: uuid("farm_id").references(() => farm.id, { onDelete: "cascade" }),
    districtId: uuid("district_id")
      .notNull()
      .references(() => district.id, { onDelete: "cascade" }),
    stateOverride: quotaStateEnum("state_override").notNull(),
    reason: text("reason").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: quotaOverrideStatusEnum("status").default("active").notNull(),
    approvedByUserId: text("approved_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    revokedByUserId: text("revoked_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("quota_override_scope_status_start_idx").on(
      t.scopeType,
      t.status,
      t.startAt,
    ),
    index("quota_override_farm_idx").on(t.farmId),
    index("quota_override_district_idx").on(t.districtId),
    index("quota_override_approved_by_idx").on(t.approvedByUserId),
  ],
);

/**
 * irrigation_recommendation: Full traceability record for every AI irrigation plan.
 * Stores system prompt, raw AI response, parsed plan, model used, and lifecycle.
 * INSERT-only for the application service account — historical records are immutable.
 */
export const irrigationRecommendation = pgTable(
  "irrigation_recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farm.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    // Full prompt traceability — store everything for government compliance
    systemPrompt: text("system_prompt").notNull(),
    userMessage: text("user_message").notNull(),
    rawResponse: text("raw_response").notNull(),

    // Parsed + validated plan
    plan: jsonb("plan").notNull(),
    totalLitres: integer("total_litres").notNull(),

    // Which model generated this plan
    modelUsed: text("model_used").notNull(),
    fallback: boolean("fallback").notNull().default(false),

    // Lifecycle: PENDING → ACTIVATED → COMPLETED or CANCELLED
    status: recommendationStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (t) => [
    index("irrigation_rec_farm_created_idx").on(t.farmId, t.createdAt),
    index("irrigation_rec_status_idx").on(t.status),
    index("irrigation_rec_requested_by_idx").on(t.requestedBy),
  ],
);

/**
 * irrigation_event: Lifecycle for farmer-triggered irrigation executions.
 */
export const irrigationEvent = pgTable(
  "irrigation_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farm.id, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id").references(
      () => irrigationRecommendation.id,
      {
        onDelete: "set null",
      },
    ),
    triggeredByUserId: text("triggered_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    wellIds: uuid("well_ids").array().notNull(),
    status: irrigationEventStatusEnum("status").notNull().default("REQUESTED"),
    planSource: text("plan_source").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    actualConsumptionM3: numeric("actual_consumption_m3", {
      precision: 15,
      scale: 4,
    }),
    quotaDebitM3: numeric("quota_debit_m3", {
      precision: 15,
      scale: 4,
    }),
    quotaDebitStatus: irrigationDebitStatusEnum("quota_debit_status")
      .notNull()
      .default("PENDING"),
    quotaDebitAttempts: integer("quota_debit_attempts").notNull().default(0),
    quotaDebitLastError: text("quota_debit_last_error"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("irrigation_event_farm_created_idx").on(t.farmId, t.createdAt),
    index("irrigation_event_status_idx").on(t.status),
    index("irrigation_event_triggered_by_idx").on(t.triggeredByUserId),
  ],
);

/**
 * well_valve_state: Immutable audit log of valve transitions per irrigation event.
 */
export const wellValveState = pgTable(
  "well_valve_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wellId: uuid("well_id")
      .notNull()
      .references(() => well.id, { onDelete: "cascade" }),
    state: irrigationValveAuditStateEnum("state").notNull(),
    irrigationEventId: uuid("irrigation_event_id")
      .notNull()
      .references(() => irrigationEvent.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    transitionedAt: timestamp("transitioned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("well_valve_state_event_transitioned_idx").on(
      t.irrigationEventId,
      t.transitionedAt,
    ),
    index("well_valve_state_well_transitioned_idx").on(
      t.wellId,
      t.transitionedAt,
    ),
  ],
);

/**
 * irrigation_simulation_run: Diagnostics and replay envelope metadata per run.
 */
export const irrigationSimulationRun = pgTable(
  "irrigation_simulation_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    irrigationEventId: uuid("irrigation_event_id")
      .notNull()
      .references(() => irrigationEvent.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(true),
    queueJobId: text("queue_job_id"),
    runStatus: irrigationSimulationRunStatusEnum("run_status")
      .notNull()
      .default("QUEUED"),
    engineVersion: text("engine_version").notNull(),
    hydrologyModelVersion: text("hydrology_model_version").notNull(),
    modelMode: irrigationModelModeEnum("model_mode")
      .notNull()
      .default("production"),
    rngSeed: text("rng_seed"),
    inputHash: text("input_hash"),
    inputEnvelopeJson: jsonb("input_envelope_json"),
    providerSnapshotHash: text("provider_snapshot_hash"),
    providerSnapshotJson: jsonb("provider_snapshot_json"),
    pricingSnapshotVersion: text("pricing_snapshot_version"),
    adapterUnitVersion: text("adapter_unit_version"),
    startTimestamp: timestamp("start_timestamp", {
      withTimezone: true,
    }).notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    integrationStepCount: integer("integration_step_count")
      .notNull()
      .default(0),
    phaseStepCountsJson: jsonb("phase_step_counts_json"),
    retryCount: integer("retry_count").notNull().default(0),
    dtMinObservedS: numeric("dt_min_observed_s", { precision: 12, scale: 4 }),
    dtMaxObservedS: numeric("dt_max_observed_s", { precision: 12, scale: 4 }),
    errorNormMax: doublePrecision("error_norm_max"),
    errorNormP95: doublePrecision("error_norm_p95"),
    numericalDivergenceCount: integer("numerical_divergence_count")
      .notNull()
      .default(0),
    massDebtPeakM3: numeric("mass_debt_peak_m3", { precision: 15, scale: 4 }),
    debtEventCount: integer("debt_event_count").notNull().default(0),
    qualityStateCountsJson: jsonb("quality_state_counts_json"),
    anomalyCodeCountsJson: jsonb("anomaly_code_counts_json"),
    trajectoryHash: text("trajectory_hash"),
    summaryHash: text("summary_hash"),
    replayLastStatus: text("replay_last_status"),
    replayLastOutputHash: text("replay_last_output_hash"),
    replayLastCheckedAt: timestamp("replay_last_checked_at", {
      withTimezone: true,
    }),
    replayLastError: text("replay_last_error"),
    diffStatus: text("diff_status"),
    diffBaseRunId: uuid("diff_base_run_id"),
    diffMetricsJson: jsonb("diff_metrics_json"),
    diffComputedAt: timestamp("diff_computed_at", { withTimezone: true }),
    queueWaitTimeMs: integer("queue_wait_time_ms"),
    executionTimeMs: integer("execution_time_ms"),
    runCostUsd: numeric("run_cost_usd", { precision: 15, scale: 6 }),
    runCostBreakdownJson: jsonb("run_cost_breakdown_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("irrigation_sim_run_event_idx").on(t.irrigationEventId),
    index("irrigation_sim_run_event_primary_idx").on(
      t.irrigationEventId,
      t.isPrimary,
    ),
    index("irrigation_sim_run_status_created_idx").on(t.runStatus, t.createdAt),
    index("irrigation_sim_run_hydrology_version_idx").on(
      t.hydrologyModelVersion,
    ),
    index("irrigation_sim_run_model_mode_idx").on(t.modelMode),
    unique("irrigation_sim_run_queue_job_key").on(t.queueJobId),
  ],
);

/**
 * sensor_data_simulation: Isolated telemetry store for synthetic readings.
 * Keeps simulation data out of REAL operational ingest/query paths by default.
 */
export const sensorDataSimulation = pgTable(
  "sensor_data_simulation",
  {
    sensorId: uuid("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "cascade" }),
    simulationRunId: uuid("simulation_run_id")
      .notNull()
      .references(() => irrigationSimulationRun.id, { onDelete: "cascade" }),
    irrigationEventId: uuid("irrigation_event_id")
      .notNull()
      .references(() => irrigationEvent.id, { onDelete: "cascade" }),
    source: irrigationTelemetrySourceEnum("source")
      .notNull()
      .default("SIMULATION"),
    value: doublePrecision("value").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    generatorVersion: text("generator_version").notNull(),
  },
  (t) => [
    index("sensor_data_sim_source_sensor_ts_idx").on(
      t.source,
      t.sensorId,
      t.timestamp,
    ),
    index("sensor_data_sim_run_ts_idx").on(t.simulationRunId, t.timestamp),
    index("sensor_data_sim_event_ts_idx").on(t.irrigationEventId, t.timestamp),
    unique("sensor_data_sim_run_sensor_ts_key").on(
      t.simulationRunId,
      t.sensorId,
      t.timestamp,
    ),
  ],
);

/**
 * irrigation_session: Temporary session state for live pump animations.
 * Stores frame count and liters pumped during active irrigation preview/setup.
 * Gets cleaned up after session completes or expires.
 */
export const irrigationSession = pgTable(
  "irrigation_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farm.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => irrigationRecommendation.id, {
      onDelete: "cascade",
    }),
    frameCount: integer("frame_count").notNull().default(0),
    litersPumped: numeric("liters_pumped", { precision: 15, scale: 4 })
      .notNull()
      .default("0"),
    done: boolean("done").notNull().default(false),
    running: boolean("running").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("irrigation_session_farm_plan_idx").on(t.farmId, t.planId),
    index("irrigation_session_updated_at_idx").on(t.updatedAt),
  ],
);

// ============================================================================
// USER MANAGEMENT v2 — Enums
// ============================================================================

export const tokenTypeEnum = pgEnum("token_type", [
  "invitation",
  "password_reset",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const emailTypeEnum = pgEnum("email_type", [
  "welcome_invitation",
  "password_reset",
  "farm_scope_grant",
  "password_changed_confirmation",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "dead",
]);

export const outboxEventStatusEnum = pgEnum("outbox_event_status", [
  "pending",
  "processing",
  "done",
  "dead",
]);

export const reportTypeEnum = pgEnum("report_type", [
  "user_activity",
  "district_governance",
  "compliance",
  "audit_trail",
  "monthly_governance_pack",
]);

export const reportScopeTypeEnum = pgEnum("report_scope_type", [
  "global",
  "district",
  "farm",
  "user",
]);

export const reportJobStatusEnum = pgEnum("report_job_status", [
  "queued",
  "processing",
  "completed",
  "partial_failed",
  "failed",
  "cancelled",
]);

export const reportGenerationModeEnum = pgEnum("report_generation_mode", [
  "strict",
  "partial",
]);

export const reportFormatEnum = pgEnum("report_format", ["pdf", "csv", "xlsx"]);

export const reportArtifactStatusEnum = pgEnum("report_artifact_status", [
  "ready",
  "failed",
  "expired",
]);

export const reportSnapshotTypeEnum = pgEnum("report_snapshot_type", [
  "logical",
  "physical",
]);

// ============================================================================
// USER MANAGEMENT v2 — Tables
// ============================================================================

/**
 * audit_log: Immutable ledger for security-sensitive entity mutations.
 * Every role change, farm assignment, and deactivation MUST produce a row here.
 * Command pattern: written inside RoleAssigner and FarmScopeAssigner, never externally.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // 'user_role' | 'farm_scope' | 'user_deactivation'
    entityId: text("entity_id").notNull(), // userId affected
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("audit_log_entity_type_id_idx").on(t.entityType, t.entityId),
    index("audit_log_actor_id_idx").on(t.actorId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

/**
 * user_invitation: Unified token model for both first-time invitations and password resets.
 * CRITICAL: Only SHA-256(rawToken) is stored — rawToken never touches the DB.
 * Enforced at the type level by RawToken Value Object.
 */
export const userInvitation = pgTable(
  "user_invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenType: tokenTypeEnum("token_type").notNull(),
    tokenHash: text("token_hash").notNull().unique(), // SHA-256(rawToken) — NEVER raw
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    farmId: uuid("farm_id").references(() => farm.id, { onDelete: "set null" }),
    status: invitationStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ipRequestedFrom: text("ip_requested_from"), // Nullified after 90 days (PDPL)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("user_invitation_token_hash_idx").on(t.tokenHash), // Primary lookup path
    index("user_invitation_user_id_idx").on(t.userId),
    index("user_invitation_status_idx").on(t.status),
    index("user_invitation_expires_at_idx").on(t.expiresAt), // Expiry cleanup cron
    index("user_invitation_type_status_idx").on(t.tokenType, t.status),
  ],
);

/**
 * user_notification_preference: per-user notification delivery preferences.
 * emailOptOut=true means transactional outbox dispatch must skip delivery.
 */
export const userNotificationPreference = pgTable(
  "user_notification_preference",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    emailOptOut: boolean("email_opt_out").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("user_notification_pref_opt_out_idx").on(t.emailOptOut)],
);

/**
 * email_audit_log: Legally defensible record of every email attempt.
 * Updated by AuditingEmailTransport (Decorator pattern) — never by business logic.
 * deliveredAt / openedAt populated by provider webhook for government compliance proof.
 */
export const emailAuditLog = pgTable(
  "email_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: text("recipient_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    recipientEmail: text("recipient_email").notNull(),
    emailType: emailTypeEnum("email_type").notNull(),
    status: emailStatusEnum("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"), // SMTP/SES message ID for tracing
    ipRequestedFrom: text("ip_requested_from"), // Nullified after 90 days (PDPL)
    deliveredAt: timestamp("delivered_at", { withTimezone: true }), // From provider webhook
    openedAt: timestamp("opened_at", { withTimezone: true }), // From provider webhook
    errorDetail: text("error_detail"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_audit_log_user_idx").on(t.recipientUserId),
    index("email_audit_log_type_idx").on(t.emailType),
    index("email_audit_log_status_idx").on(t.status),
    index("email_audit_log_provider_message_id_idx").on(t.providerMessageId),
    index("email_audit_log_sent_at_idx").on(t.sentAt),
  ],
);

/**
 * outbox_event: Transactional Outbox pattern — inserted inside DB transaction.
 * Cron job reads pending rows, dispatches email, marks processed_at.
 * Crash-safe: if server dies between commit and send, the row survives until next cron.
 * Exactly-once delivery guarantee. Dead-lettered at maxAttempts.
 */
export const outboxEvent = pgTable(
  "outbox_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(), // 'user.invited' | 'password.reset' | etc.
    payload: jsonb("payload").notNull(), // Email template variables (typed in OutboxPayload)
    status: outboxEventStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }), // Exponential backoff
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("outbox_event_status_created_idx").on(t.status, t.createdAt), // Primary dispatch query
    index("outbox_event_next_retry_idx").on(t.nextRetryAt),
  ],
);

/**
 * report_job: Report generation lifecycle envelope.
 * Stores normalized request identity for idempotency and deterministic replay.
 */
export const reportJob = pgTable(
  "report_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportType: reportTypeEnum("report_type").notNull(),
    status: reportJobStatusEnum("status").default("queued").notNull(),
    generationMode: reportGenerationModeEnum("generation_mode")
      .default("strict")
      .notNull(),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    scopeType: reportScopeTypeEnum("scope_type").default("global").notNull(),
    scopeDistrictId: uuid("scope_district_id").references(() => district.id, {
      onDelete: "set null",
    }),
    scopeFarmId: uuid("scope_farm_id").references(() => farm.id, {
      onDelete: "set null",
    }),
    scopeUserId: text("scope_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    timeRangeFrom: timestamp("time_range_from", { withTimezone: true }),
    timeRangeTo: timestamp("time_range_to", { withTimezone: true }),
    granularity: text("granularity").default("daily").notNull(),
    parameterSchemaVersion: text("parameter_schema_version")
      .default("report-params-v1")
      .notNull(),
    normalizedParametersHash: text("normalized_parameters_hash").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    snapshotType: reportSnapshotTypeEnum("snapshot_type")
      .default("logical")
      .notNull(),
    snapshotMetadata: jsonb("snapshot_metadata"),
    templateVersion: text("template_version").notNull(),
    policyVersion: text("policy_version").notNull(),
    maskingRulesVersion: text("masking_rules_version").notNull(),
    errorDetail: text("error_detail"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "report_job_scope_global_check",
      sql`(
        (${t.scopeType} = 'global' and ${t.scopeDistrictId} is null and ${t.scopeFarmId} is null and ${t.scopeUserId} is null)
        or
        (${t.scopeType} = 'district' and ${t.scopeDistrictId} is not null and ${t.scopeFarmId} is null and ${t.scopeUserId} is null)
        or
        (${t.scopeType} = 'farm' and ${t.scopeFarmId} is not null and ${t.scopeDistrictId} is null and ${t.scopeUserId} is null)
        or
        (${t.scopeType} = 'user' and ${t.scopeUserId} is not null and ${t.scopeDistrictId} is null and ${t.scopeFarmId} is null)
      )`,
    ),
    index("report_job_status_created_idx").on(t.status, t.createdAt),
    index("report_job_requested_by_created_idx").on(t.requestedBy, t.createdAt),
    index("report_job_scope_idx").on(
      t.scopeType,
      t.scopeDistrictId,
      t.scopeFarmId,
    ),
    unique("report_job_fingerprint_unique").on(
      t.reportType,
      t.normalizedParametersHash,
      t.snapshotId,
      t.templateVersion,
      t.policyVersion,
    ),
  ],
);

/**
 * report_artifact: Generated report outputs per format.
 */
export const reportArtifact = pgTable(
  "report_artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportJobId: uuid("report_job_id")
      .notNull()
      .references(() => reportJob.id, { onDelete: "cascade" }),
    format: reportFormatEnum("format").notNull(),
    status: reportArtifactStatusEnum("status").default("ready").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    outputHash: text("output_hash").notNull(),
    metadata: jsonb("metadata"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("report_artifact_job_format_idx").on(t.reportJobId, t.format),
    index("report_artifact_status_idx").on(t.status),
    index("report_artifact_expires_idx").on(t.expiresAt),
    unique("report_artifact_job_format_unique").on(t.reportJobId, t.format),
  ],
);

/**
 * report_audit_log: Immutable event stream for report actions.
 */
export const reportAuditLog = pgTable(
  "report_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportJobId: uuid("report_job_id").references(() => reportJob.id, {
      onDelete: "set null",
    }),
    reportArtifactId: uuid("report_artifact_id").references(
      () => reportArtifact.id,
      { onDelete: "set null" },
    ),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actionType: text("action_type").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("report_audit_log_job_idx").on(t.reportJobId),
    index("report_audit_log_action_idx").on(t.actionType),
    index("report_audit_log_actor_idx").on(t.actorId),
    index("report_audit_log_created_idx").on(t.createdAt),
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
  farmSnapshots: many(farmPeriodConsumptionSnapshot),
  districtSnapshots: many(districtPeriodConsumptionSnapshot),
  quotaBreachEvents: many(quotaBreachEvent),
  quotaOverrides: many(quotaOverride),
  externalReferenceObservations: many(aquiferExternalReferenceObservation),
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
  externalReferenceObservations: many(aquiferExternalReferenceObservation),
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
  quotaSnapshots: many(farmPeriodConsumptionSnapshot),
  quotaBreachEvents: many(quotaBreachEvent),
  quotaOverrides: many(quotaOverride),
  irrigationRecommendations: many(irrigationRecommendation),
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

export const farmPeriodConsumptionSnapshotRelations = relations(
  farmPeriodConsumptionSnapshot,
  ({ one }) => ({
    farm: one(farm, {
      fields: [farmPeriodConsumptionSnapshot.farmId],
      references: [farm.id],
    }),
    district: one(district, {
      fields: [farmPeriodConsumptionSnapshot.districtId],
      references: [district.id],
    }),
  }),
);

export const districtPeriodConsumptionSnapshotRelations = relations(
  districtPeriodConsumptionSnapshot,
  ({ one }) => ({
    district: one(district, {
      fields: [districtPeriodConsumptionSnapshot.districtId],
      references: [district.id],
    }),
  }),
);

export const quotaBreachEventRelations = relations(
  quotaBreachEvent,
  ({ one }) => ({
    farm: one(farm, {
      fields: [quotaBreachEvent.farmId],
      references: [farm.id],
    }),
    district: one(district, {
      fields: [quotaBreachEvent.districtId],
      references: [district.id],
    }),
    resolvedByUser: one(user, {
      fields: [quotaBreachEvent.resolvedByUserId],
      references: [user.id],
    }),
  }),
);

export const quotaOverrideRelations = relations(quotaOverride, ({ one }) => ({
  farm: one(farm, {
    fields: [quotaOverride.farmId],
    references: [farm.id],
  }),
  district: one(district, {
    fields: [quotaOverride.districtId],
    references: [district.id],
  }),
  approvedByUser: one(user, {
    fields: [quotaOverride.approvedByUserId],
    references: [user.id],
  }),
  revokedByUser: one(user, {
    fields: [quotaOverride.revokedByUserId],
    references: [user.id],
  }),
}));

export const irrigationRecommendationRelations = relations(
  irrigationRecommendation,
  ({ one }) => ({
    farm: one(farm, {
      fields: [irrigationRecommendation.farmId],
      references: [farm.id],
    }),
    requestedByUser: one(user, {
      fields: [irrigationRecommendation.requestedBy],
      references: [user.id],
    }),
  }),
);

export const aquiferForecastRunRelations = relations(
  aquiferForecastRun,
  ({ one, many }) => ({
    triggeredByUser: one(user, {
      fields: [aquiferForecastRun.triggeredBy],
      references: [user.id],
    }),
    riskFlags: many(aquiferRiskFlag),
  }),
);

export const aquiferLinearRegressionModelRelations = relations(
  aquiferLinearRegressionModel,
  ({ one, many }) => ({
    approvedByUser: one(user, {
      fields: [aquiferLinearRegressionModel.approvedBy],
      references: [user.id],
    }),
    riskFlags: many(aquiferRiskFlag),
    lineageLinks: many(aquiferModelReferenceObservationLink),
  }),
);

export const aquiferRiskFlagRelations = relations(
  aquiferRiskFlag,
  ({ one }) => ({
    run: one(aquiferForecastRun, {
      fields: [aquiferRiskFlag.runId],
      references: [aquiferForecastRun.id],
    }),
    model: one(aquiferLinearRegressionModel, {
      fields: [aquiferRiskFlag.modelVersionId],
      references: [aquiferLinearRegressionModel.id],
    }),
  }),
);

export const aquiferExternalReferenceObservationRelations = relations(
  aquiferExternalReferenceObservation,
  ({ one, many }) => ({
    district: one(district, {
      fields: [aquiferExternalReferenceObservation.districtId],
      references: [district.id],
    }),
    well: one(well, {
      fields: [aquiferExternalReferenceObservation.wellId],
      references: [well.id],
    }),
    lineageLinks: many(aquiferModelReferenceObservationLink),
  }),
);

export const aquiferModelReferenceObservationLinkRelations = relations(
  aquiferModelReferenceObservationLink,
  ({ one }) => ({
    model: one(aquiferLinearRegressionModel, {
      fields: [aquiferModelReferenceObservationLink.modelVersionId],
      references: [aquiferLinearRegressionModel.id],
    }),
    observation: one(aquiferExternalReferenceObservation, {
      fields: [aquiferModelReferenceObservationLink.observationId],
      references: [aquiferExternalReferenceObservation.id],
    }),
  }),
);
