import { zoneForSignal } from "./body-zone-map";
export type DashboardZone = "neurocognitive" | "cardiorespiratory" | "core";
export const DASHBOARD_ZONES: DashboardZone[] = ["neurocognitive", "cardiorespiratory", "core"];
export const DASHBOARD_ZONE_LABEL: Record<DashboardZone, string> = { neurocognitive: "Neurocognitive", cardiorespiratory: "Cardiorespiratory", core: "Core" };
export function dashboardZoneForSignal(name: string): DashboardZone {
  const zone = zoneForSignal(name);
  return zone === "brain" ? "neurocognitive" : zone === "heart" || zone === "lungs" ? "cardiorespiratory" : "core";
}
