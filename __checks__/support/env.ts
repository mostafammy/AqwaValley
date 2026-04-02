export function resolveBaseUrl() {
  return (
    process.env.AQWA_VALLEY_URL ??
    process.env.CHECKLY_BASE_URL ??
    process.env.ENVIRONMENT_URL ??
    "http://localhost:3000"
  );
}

export function resolveAppUrl(pathname: string) {
  return new URL(pathname, resolveBaseUrl()).toString();
}
