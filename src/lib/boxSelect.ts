import {
  estimateTextWidth,
  extensionEnds,
  functionLines,
  gridWindow,
  pointMap,
  type Box,
  type Element,
  type FigureDoc,
  type Id,
} from "@geosimples/core/figure";

/**
 * Elements drawn entirely inside a box in preview coordinates (pt, Y down).
 * A shape counts when all the points it uses are inside, and a circle when
 * its whole outline is. Ids come in figure order.
 */
export function elementsInBox(doc: FigureDoc, ppu: { x: number; y: number }, box: Box): Id[] {
  const kx = ppu.x;
  const ky = ppu.y;
  const pts = pointMap(doc);
  const inside = (x: number, y: number) =>
    x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
  const pointInside = (id: Id) => {
    const p = pts.get(id);
    return !!p && inside(p.x * kx, -p.y * ky);
  };

  const contained = (el: Element): boolean => {
    switch (el.type) {
      case "point":
        return pointInside(el.id);
      case "segment":
        return pointInside(el.a) && pointInside(el.b);
      case "extension": {
        // Only while it shows: the dashed part between its ends.
        const ends = extensionEnds(el, pts);
        return !!ends && ends.every((p) => pointInside(p.id));
      }
      case "angle":
        return pointInside(el.a) && pointInside(el.vertex) && pointInside(el.b);
      case "polygon":
        return el.vertices.every(pointInside);
      case "circle": {
        const c = pts.get(el.center);
        if (!c) return false;
        const r = el.radius * kx;
        const ry = el.radius * ky;
        return inside(c.x * kx - r, -c.y * ky - ry) && inside(c.x * kx + r, -c.y * ky + ry);
      }
      case "function": {
        const lines = functionLines(el);
        return lines.length > 0 && lines.every((l) => l.every((p) => inside(p.x * kx, -p.y * ky)));
      }
      case "numberline":
        return inside(el.x[0] * kx, -el.y * ky) && inside(el.x[1] * kx, -el.y * ky);
      case "vline":
        return inside(el.x * kx, -el.range[1] * ky) && inside(el.x * kx, -el.range[0] * ky);
      case "axes":
        return inside(el.x[0] * kx, -el.y[1] * ky) && inside(el.x[1] * kx, -el.y[0] * ky);
      case "grid": {
        const w = gridWindow(doc, el);
        return inside(w.x[0] * kx, -w.y[1] * ky) && inside(w.x[1] * kx, -w.y[0] * ky);
      }
      case "text": {
        const w = estimateTextWidth(el.text, el.size) / 2;
        const h = el.size * 0.6;
        return inside(el.x * kx - w, -el.y * ky - h) && inside(el.x * kx + w, -el.y * ky + h);
      }
    }
  };

  return doc.elements.filter(contained).map((el) => el.id);
}

export function boxFrom(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}
