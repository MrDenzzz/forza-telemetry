export type Projection = (x: number, z: number) => readonly [number, number];

/**
 * Fits world positions into a `width` × `height` box, keeping proportions. The game does not
 * document its world axes; X is drawn to the right and Z up the page.
 */
export function fitPoints(
  xs: readonly number[],
  zs: readonly number[],
  width: number,
  height: number,
  padding = 8,
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
  const spanX = maxX - minX || 1;
  const spanZ = maxZ - minZ || 1;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanZ);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanZ * scale) / 2;
  return (x, z) => [offsetX + (x - minX) * scale, offsetY + (maxZ - z) * scale] as const;
}
