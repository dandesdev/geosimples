import { useEffect, useRef, useState } from "react";
import { studyPieces, studyPieceText, type ScenePart, type Study } from "@geosimples/core/figure";
import type { View } from "@/lib/camera";
import { actions } from "@/lib/actions";
import { currentStudyFocus, editPiece, useStudyEditing, useStudyFocus } from "@/lib/studyFocus";

/**
 * Typing over a piece of a study in place: a field over its text, as big as
 * the text shows. Enter or leaving it keeps what was typed, Esc drops it, and
 * Tab goes on to the next piece with a text.
 */
export function PieceEditor({ parts, vb, size }: { parts: ScenePart[]; vb: View; size: { w: number; h: number } }) {
  const editing = useStudyEditing((s) => s.editing);
  const inside = useStudyFocus();
  const current = !!editing && !!inside && inside.study.id === editing.owner && inside.path === editing.path;
  // Picking anything else ends the typing, so a later click on the piece doesn't open it again.
  useEffect(() => {
    if (editing && !current) useStudyEditing.getState().stop();
  }, [editing, current]);
  if (!editing || !inside || !current) return null;
  const part = parts.find((p) => p.owner === editing.owner && p.path === editing.path && p.text);
  const text = studyPieceText(inside.study, editing.path);
  if (!part?.text || text === null) return null;
  // The preview's viewBox is fitted whole into the box ("meet"), centered.
  const k = Math.min(size.w / vb.w, size.h / vb.h);
  const left = (size.w - vb.w * k) / 2 + (part.text.x + part.text.w / 2 - vb.x) * k;
  const top = (size.h - vb.h * k) / 2 + (part.text.y + part.text.h / 2 - vb.y) * k;
  return (
    <PieceInput
      key={`${editing.owner}:${editing.path}`}
      study={inside.study}
      path={editing.path}
      initial={text}
      left={left}
      top={top}
      width={Math.max(part.text.w * k + 28, 120)}
      fontSize={Math.max(12, inside.study.size * k)}
    />
  );
}

function PieceInput({
  study,
  path,
  initial,
  left,
  top,
  width,
  fontSize,
}: {
  study: Study;
  path: string;
  initial: string;
  left: number;
  top: number;
  width: number;
  fontSize: number;
}) {
  const [value, setValue] = useState(initial);
  const typed = useRef(initial);
  const done = useRef(false);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep && typed.current !== initial) actions.setStudyText(study.id, path, typed.current);
    useStudyEditing.getState().stop();
  };
  // Gone without losing the focus (the view changed, the piece went): what was typed stays.
  useEffect(() => {
    const owner = study.id;
    return () => {
      if (done.current) return;
      done.current = true;
      if (typed.current !== initial) actions.setStudyText(owner, path, typed.current);
      useStudyEditing.getState().stop();
    };
  }, [study.id, path, initial]);
  const next = (back: boolean) => {
    finish(true);
    const now = currentStudyFocus()?.study;
    if (!now) return;
    const texts = studyPieces(now).filter((p) => studyPieceText(now, p) !== null);
    const at = texts.indexOf(path);
    const to = texts[(at + (back ? -1 : 1) + texts.length) % texts.length];
    if (to) editPiece(now, to);
  };
  return (
    <input
      autoFocus
      value={value}
      aria-label="Texto da parte"
      spellCheck={false}
      onChange={(e) => {
        typed.current = e.target.value;
        setValue(e.target.value);
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
        else if (e.key === "Tab") {
          e.preventDefault();
          next(e.shiftKey);
        }
      }}
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-primary bg-background px-1.5 py-0.5 text-center font-serif text-foreground shadow-md outline-none ring-2 ring-primary/25"
      // Where the text is and how big it shows come from the figure.
      style={{ left, top, width, fontSize }}
    />
  );
}
