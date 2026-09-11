/** @deprecated Import from `../../geo/IranProvinceHeatmap` — thin HR wrapper. */
import {
  IranProvinceHeatmap,
  HR_HEATMAP_COPY,
  type IranHeatRow,
} from '../../geo/IranProvinceHeatmap';

export function IranPersonnelHeatmap({
  rows,
  unknownCount = 0,
}: {
  rows: IranHeatRow[];
  unknownCount?: number;
}) {
  return (
    <IranProvinceHeatmap rows={rows} unknownCount={unknownCount} copy={HR_HEATMAP_COPY} />
  );
}
