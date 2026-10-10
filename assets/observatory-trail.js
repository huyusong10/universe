// Bounded, session-only observation poses. No browser, storage or catalog dependency.
export const EXPLORATION_TRAIL_LIMIT = 8;

export function rememberView(trail, view) {
  if (!Number.isInteger(view?.id) || view.id < 0 || !view.target ||
      !['LocalSystem', 'Surface'].includes(view.stage) ||
      ![view.distance, view.yaw, view.pitch, view.roll].every(Number.isFinite) || view.distance <= 0) return trail;
  const { id, target, stage, distance, yaw, pitch, roll } = view;
  const region=typeof view.region==='string' && /^[a-z][a-z-]{0,31}$/.test(view.region) ? {region:view.region} : {};
  return [{ id, target, stage, distance, yaw, pitch, roll, ...region }, ...trail.filter(item => item.id !== id)]
    .slice(0, EXPLORATION_TRAIL_LIMIT);
}

export function recalledView(trail, id) {
  const view = trail.find(item => item.id === id);
  return view ? { ...view } : null;
}
