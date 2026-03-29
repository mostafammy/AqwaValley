export type IrrigationEventStatus =
  | "REQUESTED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "DEBIT_PENDING"
  | "FAILED"
  | "CANCELLED";

const transitionMap = {
  REQUESTED: ["QUEUED", "FAILED", "CANCELLED"],
  QUEUED: ["RUNNING", "FAILED", "CANCELLED"],
  RUNNING: ["COMPLETED", "DEBIT_PENDING", "FAILED", "CANCELLED"],
  COMPLETED: [],
  DEBIT_PENDING: ["COMPLETED", "CANCELLED", "FAILED"],
  FAILED: [],
  CANCELLED: [],
} as const;

export function isValidIrrigationTransition(
  from: IrrigationEventStatus,
  to: IrrigationEventStatus,
): boolean {
  return (transitionMap[from] as readonly string[]).includes(to);
}

export function assertIrrigationTransition(
  from: IrrigationEventStatus,
  to: IrrigationEventStatus,
): void {
  if (!isValidIrrigationTransition(from, to)) {
    throw new Error(`Invalid irrigation event transition: ${from} -> ${to}`);
  }
}
