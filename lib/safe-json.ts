const U2028 = String.fromCharCode(0x2028);
const U2029 = String.fromCharCode(0x2029);

/**
 * Serialise a value for embedding inside an inline <script> tag without
 * allowing HTML/JS breakout. Escapes <, >, & and the line/paragraph
 * separators (U+2028 / U+2029) that are valid JSON but break inline scripts.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, String.raw`\u003c`)
    .replace(/>/g, String.raw`\u003e`)
    .replace(/&/g, String.raw`\u0026`)
    .split(U2028).join(String.raw`\u2028`)
    .split(U2029).join(String.raw`\u2029`);
}
