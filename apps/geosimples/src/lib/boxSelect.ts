import { estimateTextWidth, pointMap, type Box, type Element, type FigureDoc, type Id } from "@geosimples/core/figure";

/**
 * Elements drawn entirely inside a box in preview coordinates (pt, Y down).
 * A shape counts when all the points it uses are inside, and a circle when
 * its whole outline is. Ids come in figure order.
 */
export function elementsInBox(doc: FigureDoc, k: number, box: Box): Id[] {
  const pts = pointMap(doc);
  const inside = (x: number, y: number) =>
    x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
  const pointInside = (id: Id) => {
    const p = pts.get(id);
    return !!p && inside(p.x * k, -p.y * k);
  };

  const contained = (el: Element): boolean => {
    switch (el.type) {
      case "point":
        return pointInside(el.id);
      case "segment":
        return pointInside(el.a) && pointInside(el.b);
      case "angle":
        return pointInside(el.a) && pointInside(el.vertex) && pointInside(el.b);
      case "polygon":
        return el.vertices.every(pointInside);
      case "circle": {
        const c = pts.get(el.center);
        if (!c) return false;
        const r = el.radius * k;
        return inside(c.x * k - r, -c.y * k - r) && inside(c.x * k + r, -c.y * k + r);
      }
      case "text": {
        const w = estimateTextWidth(el.text, el.size) / 2;
        const h = el.size * 0.6;
        return inside(el.x * k - w, -el.y * k - h) && inside(el.x * k + w, -el.y * k + h);
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
