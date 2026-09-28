/** Formats a sensor value without changing its numeric value. */
export function formatSensorValue(value: number | undefined, maximumFractionDigits = 2): string {
    if (value === undefined || !Number.isFinite(value)) return '-';
    return value.toLocaleString('ko-KR', { maximumFractionDigits });
}
