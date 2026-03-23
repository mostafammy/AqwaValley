## Quota Service Runtime Contract

Primary reference:

- [Quota Service Runtime Behavior](../../../docs/quota-service-runtime-behavior.md)

## Current Runtime Behavior

- Quota logic is computed on demand by quota API procedures.
- Quota logic is not currently enforced as a hard gate in ingest write path.
- Exceeded state creates monitoring/breach artifacts, not automatic ingest rejection.

## Practical Meaning

- The system tracks quota status from persisted readings when quota endpoints are queried.
- The system does not automatically block the next ingest request only because quota was exceeded.

## If You Need Hard Enforcement

Add a pre-write quota gate in ingest flow and reject requests based on policy before persisting readings.
