const NOISE_PATTERNS = [
  /^(hi|hello|hey|thanks|thx|ok|lgtm|lmao|lol|nice|yep|yes|no)\s*!?\.?$/i,
  /^[\p{Emoji}\s]+$/u,
];

const BOT_AUTHORS = ["dependabot", "dependabot[bot]", "github-actions", "github-actions[bot]", "linear", "linear-app"];

export function shouldFilterNoise(body: string, author: string): { filter: boolean; reason?: string } {
  const trimmed = body.trim();
  if (trimmed.length < 10) return { filter: true, reason: "Length under 10 characters" };
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(trimmed)) return { filter: true, reason: `Matches noise pattern: ${pattern.toString()}` };
  }
  const lowerAuthor = author.toLowerCase();
  if (BOT_AUTHORS.some((bot) => lowerAuthor.includes(bot))) {
    return { filter: true, reason: `Excluded bot author: ${author}` };
  }
  return { filter: false };
}
