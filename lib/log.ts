/**
 * Security event log. One structured line per denied action or rejected confirmation, so probing
 * (guessing ids, replaying callbacks, brute-forcing logins) is visible. Values are JSON-encoded,
 * which also keeps user-supplied text from injecting fake log lines.
 */
export function securityEvent(event: string, details: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ level: "security", event, at: new Date().toISOString(), ...details }));
}
