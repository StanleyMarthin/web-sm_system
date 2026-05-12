import {
  getCountdownDivisions,
  getCountdownSections,
  getCountdownUnits,
} from "@/features/countdown/services/countdown-service";

export interface MonitoringDivisionRow {
  divisionId: string;
  divisionName: string;
  progressPercentage: number;
  weeklyWorkHours: number;
  remainingHours: number;
  totalTargetHours: number;
  totalJobdesc: number;
}

export interface MonitoringCarRow {
  carId: string;
  unitName: string;
  ownerName: string;
  avgProgressPercentage: number;
  status: string;
  remainingWorkHours: number;
  weeklyWorkHours: number;
  estimatedWeeks: number;
  deliveryDate: string | null;
  divisions: MonitoringDivisionRow[];
}

function sortByDelivery(left: MonitoringCarRow, right: MonitoringCarRow): number {
  const leftTime = left.deliveryDate ? new Date(left.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.deliveryDate ? new Date(right.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.unitName.localeCompare(right.unitName);
}

export async function getOperationalMonitoringCars(userId: string): Promise<MonitoringCarRow[]> {
  const units = await getCountdownUnits(userId);

  const cars = await Promise.all(units.map(async (unit) => {
    const divisions = await getCountdownDivisions(userId, unit.carId);

    const divisionRows = await Promise.all(divisions.map(async (division) => {
      const sections = await getCountdownSections(userId, unit.carId, division.divisionId);

      const remainingHours = sections.reduce((sum, section) => sum + section.totalRemainingHours, 0);
      const totalTargetHours = sections.reduce((sum, section) => sum + section.totalTargetHours, 0);
      const totalJobdesc = sections.reduce((sum, section) => sum + section.totalJobdesc, 0);
      const weeklyWorkHours = Math.max(0, totalTargetHours - remainingHours);

      return {
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        progressPercentage: division.divisionProgress,
        weeklyWorkHours,
        remainingHours,
        totalTargetHours,
        totalJobdesc,
      } satisfies MonitoringDivisionRow;
    }));

    const remainingWorkHours = divisionRows.reduce((sum, division) => sum + division.remainingHours, 0);
    const weeklyWorkHours = divisionRows.reduce((sum, division) => sum + division.weeklyWorkHours, 0);
    const estimatedWeeks = weeklyWorkHours > 0 ? remainingWorkHours / weeklyWorkHours : 0;

    return {
      carId: unit.carId,
      unitName: unit.unitName,
      ownerName: unit.customerName || "-",
      avgProgressPercentage: Math.round(unit.overallProgress),
      status: unit.status,
      remainingWorkHours,
      weeklyWorkHours,
      estimatedWeeks,
      deliveryDate: unit.contractDeliveryDate,
      divisions: divisionRows.sort((left, right) => left.divisionName.localeCompare(right.divisionName)),
    } satisfies MonitoringCarRow;
  }));

  return cars.sort(sortByDelivery);
}
