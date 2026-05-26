export interface GenOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?~",
};
const AMBIGUOUS = /[O0Il1|`'"{}\[\]]/g;

function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  // rejection sampling for unbiased pick
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function generatePassword(opts: GenOptions): string {
  let pool = "";
  const required: string[] = [];
  if (opts.lower) { pool += SETS.lower; required.push(SETS.lower); }
  if (opts.upper) { pool += SETS.upper; required.push(SETS.upper); }
  if (opts.digits) { pool += SETS.digits; required.push(SETS.digits); }
  if (opts.symbols) { pool += SETS.symbols; required.push(SETS.symbols); }
  if (opts.excludeAmbiguous) {
    pool = pool.replace(AMBIGUOUS, "");
  }
  if (!pool) return "";

  const out: string[] = [];
  // Seed with at least one of each required set
  for (const set of required) {
    const cleaned = opts.excludeAmbiguous ? set.replace(AMBIGUOUS, "") : set;
    if (cleaned.length) out.push(cleaned[secureRandomInt(cleaned.length)]);
  }
  while (out.length < opts.length) {
    out.push(pool[secureRandomInt(pool.length)]);
  }
  // Fisher–Yates shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, opts.length).join("");
}