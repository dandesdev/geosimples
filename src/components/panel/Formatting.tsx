import {
  AngleEditor,
  AxesEditor,
  CircleEditor,
  ExtensionEditor,
  FunctionEditor,
  GridEditor,
  PointEditor,
  PolygonEditor,
  SegmentEditor,
  NumberLineEditor,
  TextEditor,
  VerticalLineEditor,
} from "./elementEditors";
import { useInspected } from "./inspected";

/** Formatação: color, stroke, fill, marks and labels of the selected objects. */
export function Formatting() {
  const inspected = useInspected();
  if (!inspected) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um objeto na prévia para mudar cor, traço, preenchimento e rótulo.
      </p>
    );
  }
  const { el, props } = inspected;
  return (
    <>
      {el.type === "point" && <PointEditor el={el} {...props} />}
      {el.type === "segment" && <SegmentEditor el={el} {...props} />}
      {el.type === "extension" && <ExtensionEditor el={el} {...props} />}
      {el.type === "angle" && <AngleEditor el={el} {...props} />}
      {el.type === "circle" && <CircleEditor el={el} {...props} />}
      {el.type === "polygon" && <PolygonEditor el={el} {...props} />}
      {el.type === "text" && <TextEditor el={el} {...props} />}
      {el.type === "function" && <FunctionEditor el={el} {...props} />}
      {el.type === "vline" && <VerticalLineEditor el={el} {...props} />}
      {el.type === "numberline" && <NumberLineEditor el={el} {...props} />}
      {el.type === "axes" && <AxesEditor el={el} {...props} />}
      {el.type === "grid" && <GridEditor el={el} {...props} />}
    </>
  );
}
