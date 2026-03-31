/**
 * RawToken — Value Object
 *
 * Pattern: Value Object (Security Token Tier)
 * The `raw` field is private — the compiler prevents it from ever reaching db.insert().
 * The only two valid destinations for raw bytes are:
 *   - token.toEmailUrl()   → goes into the email link
 *   - token.toResetUrl()   → goes into the reset email link
 * The only valid DB-storable value is token.hash() (SHA-256 hex).
 *
 * This makes the security invariant machine-checkable, not comment-enforced.
 */

import { createHash, randomBytes } from "crypto";

export class RawToken {
  private constructor(private readonly raw: string) {}

  /**
   * Factory: generates a cryptographically secure 32-byte (256-bit) token.
   * Brute force is computationally infeasible against SHA-256(randomBytes(32)).
   */
  static generate(): RawToken {
    return new RawToken(randomBytes(32).toString("hex"));
  }

  /**
   * Returns SHA-256(raw) as a hex string — the ONLY value safe to store in DB.
   * Lookup: SELECT * FROM user_invitation WHERE token_hash = token.hash()
   */
  hash(): string {
    return createHash("sha256").update(this.raw).digest("hex");
  }

  /**
   * Hashes a raw token string from a URL parameter for DB lookup.
   */
  static hashFromString(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Builds the invitation activation URL including the raw token as query param.
   * Raw token goes into: email URL only. Never into DB, logs, or console.
   */
  toEmailUrl(baseUrl: string): string {
    return `${baseUrl}/set-password?token=${this.raw}`;
  }

  /**
   * Builds the password-reset URL including the raw token as query param.
   */
  toResetUrl(baseUrl: string): string {
    return `${baseUrl}/reset-password?token=${this.raw}`;
  }
}
