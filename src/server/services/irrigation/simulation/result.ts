export const domainErrorCodes = [
  "INVALID_INPUT",
  "NUMERICAL_DIVERGENCE",
  "AQUIFER_DEPLETION",
  "MISSING_MAPPING",
  "DEPENDENCY_TIMEOUT",
  "DEPENDENCY_UNAVAILABLE",
  "REPLAY_NONDETERMINISM",
  "INGEST_PATH_VIOLATION",
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  retryable: boolean;
  context?: Record<string, unknown>;
};

export type Result<T, E extends DomainError = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: DomainError): Result<T> {
  return { ok: false, error };
}

export function createDomainError(params: {
  code: DomainErrorCode;
  message: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}): DomainError {
  return {
    code: params.code,
    message: params.message,
    retryable: params.retryable,
    context: params.context,
  };
}
