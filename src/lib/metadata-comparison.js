import { sections } from './metadata.js';

function fields(metadata) {
  return new Map(sections(metadata).flatMap(([section, values]) =>
    Object.entries(values).map(([name, value]) => [`${section} / ${name}`, value])));
}
export function displayValue(value) {
  if (value === undefined) return 'Not detected';
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
export function compareMetadata(before, after) {
  const a = fields(before), b = fields(after);
  const order = name => name.startsWith('GPS /') ? 0 : name.startsWith('Camera /') ? 1 : name.startsWith('Color Profile /') ? 3 : 2;
  return [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => order(x) - order(y) || x.localeCompare(y)).map(name => ({
    name,
    before: !a.has(name) && before?.scanError ? 'Unknown' : displayValue(a.get(name)),
    after: !b.has(name) && after?.scanError ? 'Unknown' : displayValue(b.get(name)),
    status: !b.has(name) ? (after?.scanError ? 'Unverified' : 'Not detected afterward')
      : !a.has(name) ? (before?.scanError ? 'Unverified' : 'Output field')
      : displayValue(a.get(name)) === displayValue(b.get(name)) ? 'Still present' : 'Changed',
  }));
}
export function locationSummary(metadata) {
  const gps = metadata?.GPS;
  if (!gps || !Object.keys(gps).length) return null;
  const coordinate = (decimal, dms, ref) => {
    if (typeof decimal === 'number' && Number.isFinite(decimal)) return decimal.toFixed(6);
    if (Array.isArray(dms) && dms.length === 3 && dms.every(Number.isFinite)) {
      const value = dms[0] + dms[1] / 60 + dms[2] / 3600;
      return (value * (/^[SW]$/i.test(ref) ? -1 : 1)).toFixed(6);
    }
    return null;
  };
  const lat = coordinate(gps.latitude, gps.GPSLatitude, gps.GPSLatitudeRef);
  const lon = coordinate(gps.longitude, gps.GPSLongitude, gps.GPSLongitudeRef);
  return lat !== null && lon !== null ? `Coordinates: ${lat}, ${lon}` : `${Object.keys(gps).length} GPS fields detected. See raw metadata for details.`;
}
