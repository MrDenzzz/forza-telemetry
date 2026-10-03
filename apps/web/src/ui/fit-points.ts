export type Projection = (x: number, z: number) => readonly [number, number];

/**
 * Fits world positions into a `width` × `height` box, keeping proportions and centring them. The
 * scale is never larger than `minSpan` metres across would give. The game does not document its
 * world axes; X is drawn to the right and Z up the page.
 */
export function fitPoints(
  xs: readonly number[],
  zs: readonly number[],
  width: number,
  height: number,
  padding = 8,
  minSpan = 0,
): Projection {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const x of xs) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  for (const z of zs) {
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const scale = Math.min(
    (width - 2 * padding) / (Math.max(spanX, minSpan) || 1),
    (height - 2 * padding) / (Math.max(spanZ, minSpan) || 1),
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanZ * scale) / 2;
  return (x, z) => [offsetX + (x - minX) * scale, offsetY + (maxZ - z) * scale] as const;
}
