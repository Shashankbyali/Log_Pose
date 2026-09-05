export function formatWalkingEta(seconds: number): string {
  if (seconds > 15 * 60) return "15+ min";
  return `~${Math.max(0, Math.round(seconds / 60))} min`;
}
