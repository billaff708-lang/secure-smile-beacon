export interface Analysis {
  password: string;
  length: number;
  entropy: number;
  charsetSize: number;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  crackTimes: { scenario: string; guessesPerSec: number; seconds: number; display: string }[];
  warnings: string[];
  suggestions: string[];
  composition: { type: string; count: number }[];
}

const COMMON = [
  "password","123456","12345678","qwerty","abc123","111111","letmein","admin",
  "welcome","monkey","dragon","iloveyou","password1","qwerty123","000000","1q2w3e",
];

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz","0123456789","qwertyuiop","asdfghjkl","zxcvbnm"];

function charsetSize(pw: string): number {
  let size = 0;
  if (/[a-z]/.test(pw)) size += 26;
  if (/[A-Z]/.test(pw)) size += 26;
  if (/[0-9]/.test(pw)) size += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) size += 33;
  return size || 1;
}

function detectSequence(pw: string): boolean {
  const lower = pw.toLowerCase();
  for (const seq of SEQUENCES) {
    for (let i = 0; i <= seq.length - 4; i++) {
      const chunk = seq.slice(i, i + 4);
      if (lower.includes(chunk) || lower.includes(chunk.split("").reverse().join(""))) return true;
    }
  }
  return false;
}

function detectRepeats(pw: string): boolean {
  return /(.)\1{2,}/.test(pw);
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds > 1e20) return "centuries";
  if (seconds < 1e-6) return "instant";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  const units: [number, string][] = [
    [60, "seconds"],
    [60, "minutes"],
    [24, "hours"],
    [365, "days"],
    [100, "years"],
    [10, "centuries"],
    [Infinity, "millennia"],
  ];
  let value = seconds;
  let unit = "seconds";
  for (const [div, name] of units) {
    if (value < div) {
      return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
    }
    value /= div;
    unit = name;
  }
  return `${value.toFixed(0)} ${unit}`;
}

export function analyze(pw: string): Analysis {
  const length = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const cs = charsetSize(pw);
  let entropy = length > 0 ? length * Math.log2(cs) : 0;

  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (length === 0) {
    return {
      password: pw, length: 0, entropy: 0, charsetSize: 0,
      hasLower, hasUpper, hasDigit, hasSymbol,
      score: 0, label: "Awaiting input",
      crackTimes: [], warnings: [], suggestions: [],
      composition: [],
    };
  }

  if (COMMON.includes(pw.toLowerCase())) {
    warnings.push("Found in common password lists");
    entropy = Math.min(entropy, 8);
  }
  if (detectSequence(pw)) {
    warnings.push("Contains keyboard/alphabet sequence");
    entropy *= 0.7;
  }
  if (detectRepeats(pw)) {
    warnings.push("Contains repeated characters");
    entropy *= 0.85;
  }
  if (length < 8) warnings.push("Below minimum recommended length");

  if (length < 12) suggestions.push("Use 12+ characters for stronger defense");
  if (!hasUpper) suggestions.push("Add uppercase letters [A-Z]");
  if (!hasDigit) suggestions.push("Add digits [0-9]");
  if (!hasSymbol) suggestions.push("Add special symbols [!@#$...]");
  if (length >= 16 && hasUpper && hasLower && hasDigit && hasSymbol && warnings.length === 0) {
    suggestions.push("Strong. Rotate periodically and never reuse.");
  }

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (entropy >= 28) score = 1;
  if (entropy >= 50) score = 2;
  if (entropy >= 70) score = 3;
  if (entropy >= 90) score = 4;

  const labels = ["Critical", "Weak", "Moderate", "Strong", "Fortress"];
  const label = labels[score];

  const guesses = Math.pow(2, entropy) / 2;
  const scenarios = [
    { scenario: "Online throttled (100/s)", guessesPerSec: 100 },
    { scenario: "Online no throttle (10k/s)", guessesPerSec: 1e4 },
    { scenario: "Offline bcrypt (10k/s)", guessesPerSec: 1e4 },
    { scenario: "Offline SHA-256 GPU (1e10/s)", guessesPerSec: 1e10 },
    { scenario: "Massive cluster (1e12/s)", guessesPerSec: 1e12 },
    { scenario: "Dictionary + rules (1e6/s)", guessesPerSec: 1e6 },
    { scenario: "Rainbow tables (MD5, 1e11/s)", guessesPerSec: 1e11 },
    { scenario: "Nation-state ASIC (1e14/s)", guessesPerSec: 1e14 },
  ];
  const crackTimes = scenarios.map((s) => {
    const seconds = guesses / s.guessesPerSec;
    return { ...s, seconds, display: formatTime(seconds) };
  });

  const composition = [
    { type: "lowercase", count: (pw.match(/[a-z]/g) || []).length },
    { type: "uppercase", count: (pw.match(/[A-Z]/g) || []).length },
    { type: "digits", count: (pw.match(/[0-9]/g) || []).length },
    { type: "symbols", count: (pw.match(/[^a-zA-Z0-9]/g) || []).length },
  ];

  return {
    password: pw, length, entropy, charsetSize: cs,
    hasLower, hasUpper, hasDigit, hasSymbol,
    score, label, crackTimes, warnings, suggestions, composition,
  };
}