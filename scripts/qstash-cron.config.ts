export type ManagedCronJob = {
  key: string;
  path: string;
  cron: string;
  method?: "GET" | "POST";
  body?: unknown;
};

export const QSTASH_CRON_JOBS: ManagedCronJob[] = [
  {
    key: "process-report-jobs",
    path: "/api/cron/process-report-jobs",
    cron: "*/2 * * * *",
    method: "POST",
  },
  {
    key: "dispatch-emails",
    path: "/api/cron/dispatch-emails",
    cron: "*/2 * * * *",
    method: "POST",
  },
];
