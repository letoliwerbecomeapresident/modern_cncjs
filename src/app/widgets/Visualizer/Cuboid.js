import { BoxGeometry, EdgesGeometry, LineBasicMaterial, LineDashedMaterial, LineSegments } from 'three';

class Cuboid {
  constructor(options) {
    const {
      dx = 0,
      dy = 0,
      dz = 0,
      color = 0x000000,
      opacity = 1,
      transparent = true,
      dashed = false,
      ...others
    } = { ...options };

    const geometry = new BoxGeometry(
      dx, // width
      dy, // height
      dz, // depth
    );
    const edges = new EdgesGeometry(geometry);

    let material;

    if (dashed) {
      material = new LineDashedMaterial({
        color,
        opacity,
        transparent,
        ...others
      });
    } else {
      material = new LineBasicMaterial({
        color,
        opacity,
        transparent,
        ...others
      });
    }

    const lineSegments = new LineSegments(edges, material);

    if (dashed) {
      // Computes an array of distance values which are necessary for LineDashedMaterial.
      lineSegments.computeLineDistances();
    }

    return lineSegments;
  }
}

export default Cuboid;
