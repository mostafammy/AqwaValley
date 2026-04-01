import { QSTASH_CRON_JOBS } from "./qstash-cron.config";

type QstashListResponse = {
  data?: QstashSchedule[];
};

type QstashSchedule = {
  id?: string;
  scheduleId?: string;
  cron?: string;
  message?: {
    to?: string;
    method?: string;
  };
};

type DesiredSchedule = {
  key: string;
  cron: string;
  method: "GET" | "POST";
  destination: string;
  body: string | undefined;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeAppUrl(rawAppUrl: string): URL {
  const stripped = rawAppUrl.trim().replace(/^['\"]|['\"]$/g, "");
  const withProtocol = /^https?:\/\//i.test(stripped)
    ? stripped
    : `https://${stripped}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(
      `Invalid APP_URL value. Expected an absolute URL like https://example.com, received: ${rawAppUrl}`,
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `Invalid APP_URL protocol (${parsed.protocol}). Use http:// or https://.`,
    );
  }

  return parsed;
}

function getScheduleId(schedule: QstashSchedule): string | undefined {
  return schedule.scheduleId ?? schedule.id;
}

function getDestination(schedule: QstashSchedule): string {
  return schedule.message?.to ?? "";
}

function getMethod(schedule: QstashSchedule): string {
  return (schedule.message?.method ?? "POST").toUpperCase();
}

function getCronKey(destination: string): string | null {
  try {
    const url = new URL(destination);
    return url.searchParams.get("cronKey");
  } catch {
    return null;
  }
}

async function qstashFetch(
  apiBase: string,
  token: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `QStash API ${init?.method ?? "GET"} ${path} failed (${response.status}): ${details}`,
    );
  }

  return response;
}

function buildDesiredSchedules(
  appUrl: string,
): Record<string, DesiredSchedule> {
  const base = normalizeAppUrl(appUrl);

  return Object.fromEntries(
    QSTASH_CRON_JOBS.map((job) => {
      const destination = new URL(job.path, base);
      destination.searchParams.set("cronKey", job.key);

      const method = job.method ?? "POST";
      const body =
        job.body === undefined ? undefined : JSON.stringify(job.body);

      return [
        job.key,
        {
          key: job.key,
          cron: job.cron,
          method,
          destination: destination.toString(),
          body,
        },
      ];
    }),
  );
}

async function listSchedules(
  apiBase: string,
  token: string,
): Promise<QstashSchedule[]> {
  const response = await qstashFetch(apiBase, token, "/v2/schedules");
  const payload = (await response.json()) as
    | QstashListResponse
    | QstashSchedule[];

  if (Array.isArray(payload)) return payload;
  return payload.data ?? [];
}

async function deleteSchedule(
  apiBase: string,
  token: string,
  scheduleId: string,
) {
  await qstashFetch(
    apiBase,
    token,
    `/v2/schedules/${encodeURIComponent(scheduleId)}`,
    {
      method: "DELETE",
    },
  );
}

async function createSchedule(
  apiBase: string,
  token: string,
  schedule: DesiredSchedule,
) {
  const encodedDestination = encodeURIComponent(schedule.destination);

  await qstashFetch(apiBase, token, `/v2/schedules/${encodedDestination}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Upstash-Cron": schedule.cron,
      "Upstash-Method": schedule.method,
      "Upstash-Retries": "3",
      "Upstash-Forward-Content-Type": "application/json",
    },
    body: schedule.body ?? "{}",
  });
}

function needsRecreate(
  current: QstashSchedule,
  desired: DesiredSchedule,
): boolean {
  const currentCron = current.cron ?? "";
  const currentDestination = getDestination(current);
  const currentMethod = getMethod(current);

  return (
    currentCron !== desired.cron ||
    currentDestination !== desired.destination ||
    currentMethod !== desired.method
  );
}

async function main() {
  const token = requireEnv("QSTASH_TOKEN");
  const appUrl = requireEnv("APP_URL");
  const apiBase = (
    process.env.QSTASH_API_BASE ?? "https://qstash.upstash.io"
  ).replace(/\/$/, "");

  const desiredByKey = buildDesiredSchedules(appUrl);
  const desiredKeys = new Set(Object.keys(desiredByKey));

  const allSchedules = await listSchedules(apiBase, token);
  const managed = allSchedules.filter((schedule) => {
    const key = getCronKey(getDestination(schedule));
    return key !== null;
  });

  console.log(
    `[qstash-sync] Found ${allSchedules.length} total schedules (${managed.length} managed).`,
  );

  let deleted = 0;
  let created = 0;
  let unchanged = 0;

  for (const schedule of managed) {
    const scheduleId = getScheduleId(schedule);
    const key = getCronKey(getDestination(schedule));

    if (!scheduleId || !key) continue;

    const desired = desiredByKey[key];
    if (!desired) {
      await deleteSchedule(apiBase, token, scheduleId);
      deleted += 1;
      console.log(
        `[qstash-sync] Deleted stale schedule ${scheduleId} (key=${key}).`,
      );
      continue;
    }

    if (needsRecreate(schedule, desired)) {
      await deleteSchedule(apiBase, token, scheduleId);
      deleted += 1;
      console.log(
        `[qstash-sync] Replacing schedule ${scheduleId} (key=${key}).`,
      );
    } else {
      unchanged += 1;
      desiredKeys.delete(key);
    }
  }

  for (const key of desiredKeys) {
    const desired = desiredByKey[key];
    if (!desired) continue;

    await createSchedule(apiBase, token, desired);
    created += 1;
    console.log(`[qstash-sync] Created schedule for key=${key}.`);
  }

  console.log(
    `[qstash-sync] Completed. created=${created} deleted=${deleted} unchanged=${unchanged}`,
  );
}

void main().catch((error) => {
  console.error("[qstash-sync] Failed:", error);
  process.exitCode = 1;
});
