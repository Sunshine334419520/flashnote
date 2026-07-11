/**
 * Redact secret-looking substrings before they reach logs. Pattern-based so it
 * works on already-formatted prompt/response strings without structural context.
 * Applied ONLY to logged copies — the real content still reaches the AI provider.
 * Over-masking is preferred to leaking a credential.
 */

const SECRET_PATTERNS: RegExp[] = [
  // Prefixed API keys / tokens: sk-..., ghp_..., github_pat_..., xoxb-..., AKIA...
  /(?:sk|pk|rk|api|key|tok|token|ghp|gho|ghs|ghr|glpat|xox[baprs]|AKIA|ASIA)[-_][A-Za-z0-9_-]{6,}/gi,
  // Long opaque tokens (base64/hex-ish)
  /[A-Za-z0-9_-]{32,}/g,
  // Bank card with 4-digit groups (space/dash separated)
  /\b\d{4}(?:[ -]\d{4}){2,3}\b/g,
  // Bank card / long digit runs
  /\b\d{13,19}\b/g,
  // Chinese ID card
  /\b\d{17}[\dXx]\b/g
]

function redact(match: string): string {
  if (match.length <= 8) return '***'
  return `${match.slice(0, 4)}***${match.slice(-2)}(${match.length})`
}

export function maskSecrets(text: string): string {
  let out = text
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, redact)
  return out
}
