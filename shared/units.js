// Engineering-notation parser shared by every tool.
// Handles p, n, u, m, k, M, G suffixes. Case matters: m = milli, M = mega.
// Also tolerates a trailing "Hz" / "hz" so the frequency field accepts "1kHz".

const prefixes = {
  p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3,
  k: 1e3,   M: 1e6,  G: 1e9
};

export function parseEngineeringNotation(str) {
  str = String(str).trim().replace(/[Hh]z$/, '');
  if (!str) throw new Error('Empty');

  const lastChar = str.slice(-1);
  if (prefixes[lastChar]) {
    const numPart = parseFloat(str.slice(0, -1));
    if (isNaN(numPart)) throw new Error('NaN');
    return numPart * prefixes[lastChar];
  }
  const num = parseFloat(str);
  if (isNaN(num)) throw new Error('NaN');
  return num;
}
