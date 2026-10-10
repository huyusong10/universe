// Shared scalar operations for world generation and navigation.
export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const mix = (a, b, amount) => a + (b - a) * amount;
export function smoothstep(a, b, value) {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
