/** A document navigation is intentional: a login tab may predate the current
 * release, so client-side navigation can keep running obsolete application code. */
export function memberDashboardPath(release = Date.now().toString()) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/dashboard/?release=${encodeURIComponent(release)}`;
}
export function redirectToMemberDashboard() {
  window.location.replace(memberDashboardPath());
}
