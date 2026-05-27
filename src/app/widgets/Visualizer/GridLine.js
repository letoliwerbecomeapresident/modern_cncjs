import { Color, Geometry, Line, LineBasicMaterial, Object3D, Vector3 } from 'three';

class GridLine {
    group = new Object3D();

    colorCenterLine = new Color(0x444444);

    colorGrid = new Color(0x888888);

    // @param {number} minX  Start of grid on X axis
    // @param {number} maxX  End of grid on X axis
    // @param {number} stepX Grid spacing on X axis
    // @param {number} minY  Start of grid on Y axis
    // @param {number} maxY  End of grid on Y axis
    // @param {number} stepY Grid spacing on Y axis
    constructor(minX, maxX, stepX, minY, maxY, stepY, colorCenterLine, colorGrid) {
      colorCenterLine = new Color(colorCenterLine ?? this.colorCenterLine);
      colorGrid = new Color(colorGrid ?? this.colorGrid);

      if (typeof minY === 'undefined') {
        minY = minX;
      }
      if (typeof maxY === 'undefined') {
        maxY = maxX;
      }
      if (typeof stepY === 'undefined') {
        stepY = stepX;
      }

      // Snap min/max to grid step boundaries
      const startX = Math.floor(minX / stepX) * stepX;
      const endX = Math.ceil(maxX / stepX) * stepX;
      const startY = Math.floor(minY / stepY) * stepY;
      const endY = Math.ceil(maxY / stepY) * stepY;

      // Horizontal lines (parallel to X axis)
      for (let i = startY; i <= endY + stepY * 0.5; i += stepY) {
        const geometry = new Geometry();
        const material = new LineBasicMaterial({
          vertexColors: true
        });
        const color = (i === 0) ? colorCenterLine : colorGrid;

        geometry.vertices.push(
          new Vector3(startX, i, 0),
          new Vector3(endX, i, 0),
        );
        geometry.colors.push(color, color);

        this.group.add(new Line(geometry, material));
      }

      // Vertical lines (parallel to Y axis)
      for (let i = startX; i <= endX + stepX * 0.5; i += stepX) {
        const geometry = new Geometry();
        const material = new LineBasicMaterial({
          vertexColors: true
        });
        const color = (i === 0) ? colorCenterLine : colorGrid;

        geometry.vertices.push(
          new Vector3(i, startY, 0),
          new Vector3(i, endY, 0),
        );
        geometry.colors.push(color, color);

        this.group.add(new Line(geometry, material));
      }

      return this.group;
    }
}

export default GridLine;
