export type Brand<T, B extends string> = T & { readonly __brand: B };

export type Meters = Brand<number, "Meters">;
export type SquareMeters = Brand<number, "SquareMeters">;
export type CubicMeters = Brand<number, "CubicMeters">;
export type CubicMetersPerSecond = Brand<number, "CubicMetersPerSecond">;
export type Seconds = Brand<number, "Seconds">;
export type Pascals = Brand<number, "Pascals">;
export type UnitInterval = Brand<number, "UnitInterval">;

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertNonNegative(value: number, label: string): void {
  if (value < 0) {
    throw new Error(`${label} must be non-negative.`);
  }
}

export function asMeters(value: number, label = "meters"): Meters {
  assertFiniteNumber(value, label);
  return value as Meters;
}

export function asSquareMeters(value: number, label = "squareMeters"): SquareMeters {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be > 0.`);
  }
  return value as SquareMeters;
}

export function asCubicMeters(value: number, label = "cubicMeters"): CubicMeters {
  assertFiniteNumber(value, label);
  assertNonNegative(value, label);
  return value as CubicMeters;
}

export function asCubicMetersPerSecond(
  value: number,
  label = "cubicMetersPerSecond",
): CubicMetersPerSecond {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new Error(`${label} must be >= 0.`);
  }
  return value as CubicMetersPerSecond;
}

export function asSeconds(value: number, label = "seconds"): Seconds {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be > 0.`);
  }
  return value as Seconds;
}

export function asPascals(value: number, label = "pascals"): Pascals {
  assertFiniteNumber(value, label);
  assertNonNegative(value, label);
  return value as Pascals;
}

export function asUnitInterval(value: number, label = "unitInterval"): UnitInterval {
  assertFiniteNumber(value, label);
  if (value < 0 || value > 1) {
    throw new Error(`${label} must be in [0, 1].`);
  }
  return value as UnitInterval;
}

export function toNumber(value: number): number {
  return value;
}
