import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { prettyMath, studyPaths, studyPiece, studyPieceName, type Study, type StudyBall, type StudySketch } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions } from "@/lib/actions";
import { useStudyFocus } from "@/lib/studyFocus";
import { cn } from "@/lib/utils";
import { useFigureStore } from "@/store/figureStore";
import { Choice, Field, NumberInput, Section, SwitchField } from "./controls";

/**
 * Propriedades of an Estudo na reta: the trail of where the selection is
 * inside it, and the fields of the piece picked or of the whole study. On a
 * phone this list is the way in, since the preview is too small to aim at
 * a divider's end.
 */
export function StudyProperties({ el }: { el: Study }) {
  const inside = useStudyFocus();
  const path = inside?.study.id === el.id ? inside.path : null;
  return (
    <>
      <Trail study={el} path={path} />
      {path ? <PieceFields key={path} study={el} path={path} /> : <WholeFields study={el} />}
    </>
  );
}

const BALLS: { value: StudyBall; label: string; title: string }[] = [
  { value: "closed", label: "Cheia", title: "Bolinha cheia: o ponto está incluído" },
  { value: "open", label: "Vazia", title: "Bolinha vazia: o ponto fica de fora" },
  { value: "none", label: "Nenhuma", title: "Só o nome, sem bolinha" },
];

const pick = (owner: string, path: string | null) => useFigureStore.getState().setFocus({ owner, path });

const pointName = (study: Study, id: string) => {
  const i = study.axis.points.findIndex((p) => p.id === id);
  const label = study.axis.points[i]?.label.trim();
  return label ? prettyMath(label) : `Ponto ${i + 1}`;
};

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs text-muted-foreground">{children}</p>;
}

/** Where the selection is: the study, and the piece picked in it. Clicking the study goes back up. */
function Trail({ study, path }: { study: Study; path: string | null }) {
  return (
    <nav aria-label="Onde está a seleção" className="mb-2 flex min-w-0 items-center gap-1 text-xs">
      <button
        type="button"
        className={cn("shrink-0 rounded px-1 py-0.5 hover:bg-muted", path ? "text-muted-foreground" : "font-medium text-foreground")}
        onClick={() => useFigureStore.getState().setFocus(null)}
      >
        Estudo na reta
      </button>
      {path && (
        <>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-medium" aria-current="location">
            {studyPieceName(study, path)}
          </span>
        </>
      )}
    </nav>
  );
}

/** A text field that writes as it is typed; edits within a second are one undo step. */
function PieceText({ study, path, label, placeholder }: { study: Study; path: string; label: string; placeholder?: string }) {
  const piece = studyPiece(study, path);
  const value =
    piece?.kind === "point" ? piece.point.label : piece?.kind === "interval" ? (study.axis.intervals[piece.index] ?? "") : piece?.kind === "sketch" ? piece.sketch.label : "";
  return (
    <Input
      value={value}
      aria-label={label}
      placeholder={placeholder}
      spellCheck={false}
      maxLength={60}
      className="h-7 font-serif"
      onChange={(e) => actions.setStudyText(study.id, path, e.target.value)}
    />
  );
}

function WholeFields({ study }: { study: Study }) {
  const id = study.id;
  const balls = new Set(study.axis.points.map((p) => p.ball));
  const ball = balls.size === 1 ? [...balls][0] : ("" as StudyBall);
  const allDividers = study.axis.points.length > 0 && study.axis.points.every((p) => p.divider);
  return (
    <>
      <Hint>Dois cliques numa parte, na prévia, para entrar no estudo e escrever nela. Esc volta um nível.</Hint>
      <Section title="Pontos">
        <ol className="mb-1 space-y-1">
          {study.axis.points.map((p, i) => (
            <li key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                className="h-7 w-7 shrink-0 rounded text-xs text-muted-foreground hover:bg-muted"
                title="Selecionar este ponto"
                onClick={() => pick(id, studyPaths.point(p.id))}
              >
                {i + 1}
              </button>
              <PieceText study={study} path={studyPaths.point(p.id)} label={`Nome do ponto ${i + 1}`} placeholder="sem nome" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Remover o ponto ${i + 1}`}
                onClick={() => actions.removeStudyPiece(id, studyPaths.point(p.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        <div className="mb-1 grid grid-cols-2 gap-1">
          <Button size="sm" variant="outline" onClick={() => actions.insertStudyPoint(id, 0)}>
            <Plus /> No início
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.insertStudyPoint(id, study.axis.points.length)}>
            <Plus /> No fim
          </Button>
        </div>
        {study.axis.points.length > 0 && (
          <>
            <Choice label="Bolinhas" value={ball} options={BALLS} onChange={(b) => actions.setStudyBalls(id, b)} />
            <SwitchField label="Divisórias" checked={allDividers} onChange={(on) => actions.setStudyDividers(id, on)} />
          </>
        )}
      </Section>
      <Section title="Intervalos">
        <ol className="mb-1 space-y-1">
          {study.axis.intervals.map((_, i) => (
            <li key={studyPaths.interval(study, i)}>
              <PieceText
                study={study}
                path={studyPaths.interval(study, i)}
                label={`Texto do intervalo ${i + 1}`}
                placeholder={
                  study.axis.points.length === 0
                    ? "a reta toda"
                    : i === 0
                      ? `antes de ${pointName(study, study.axis.points[0].id)}`
                      : i === study.axis.points.length
                        ? `depois de ${pointName(study, study.axis.points[i - 1].id)}`
                        : `entre ${pointName(study, study.axis.points[i - 1].id)} e ${pointName(study, study.axis.points[i].id)}`
                }
              />
            </li>
          ))}
        </ol>
        <Button size="sm" variant="outline" className="w-full" title="x < a, a ≤ x < b, x ≥ b, dos nomes dos pontos" onClick={() => actions.fillStudyIntervals(id)}>
          Escrever em x
        </Button>
      </Section>
      <Section title="Esboços">
        {study.axis.sketches.length > 0 && (
          <ul className="mb-1 space-y-1">
            {study.axis.sketches.map((sk) => (
              <li key={sk.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="h-7 min-w-0 flex-1 truncate rounded px-1 text-left font-serif text-sm hover:bg-muted"
                  onClick={() => pick(id, studyPaths.sketch(sk.id))}
                >
                  {sk.label.trim() ? prettyMath(sk.label) : sk.shape === "line" ? "Reta sem nome" : "Parábola sem nome"}
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Remover o esboço" onClick={() => actions.removeStudyPiece(id, studyPaths.sketch(sk.id))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant="outline" disabled={study.axis.points.length === 0} onClick={() => actions.addStudySketch(id, "line")}>
            <Plus /> Reta
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.addStudySketch(id, "parabola")}>
            <Plus /> Parábola
          </Button>
        </div>
      </Section>
    </>
  );
}

function PieceFields({ study, path }: { study: Study; path: string }) {
  const piece = studyPiece(study, path);
  if (!piece) return null;
  const id = study.id;
  const remove = (label: string) => (
    <Button size="sm" variant="outline" className="mt-1 w-full text-destructive hover:text-destructive" onClick={() => actions.removeStudyPiece(id, path)}>
      <Trash2 /> {label}
    </Button>
  );
  switch (piece.kind) {
    case "point": {
      const p = piece.point;
      return (
        <Section title="Ponto">
          <Field label="Nome">
            <PieceText study={study} path={path} label="Nome do ponto" placeholder="sem nome" />
          </Field>
          <Choice label="Bolinha" value={p.ball} options={BALLS} onChange={(ball) => actions.updateStudyPoint(id, p.id, { ball })} />
          <SwitchField label="Divisória" checked={p.divider} onChange={(divider) => actions.updateStudyPoint(id, p.id, { divider })} />
          {p.divider && <DividerLength study={study} point={p.id} />}
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Button size="sm" variant="outline" onClick={() => actions.insertStudyPoint(id, piece.index)}>
              <Plus /> Antes
            </Button>
            <Button size="sm" variant="outline" onClick={() => actions.insertStudyPoint(id, piece.index + 1)}>
              <Plus /> Depois
            </Button>
          </div>
          {remove("Remover ponto")}
        </Section>
      );
    }
    case "divider":
      return (
        <Section title="Divisória">
          <DividerLength study={study} point={piece.point.id} />
          {remove("Remover divisória")}
        </Section>
      );
    case "interval":
      return (
        <Section title="Intervalo">
          <Field label="Texto">
            <PieceText study={study} path={path} label="Texto do intervalo" placeholder="como 1 ≤ x < 2" />
          </Field>
          <Hint>Digite &lt;= para ≤, &gt;= para ≥ e x^2 para x².</Hint>
          {remove("Apagar texto")}
        </Section>
      );
    case "sketch":
      return <SketchFields study={study} sketch={piece.sketch} path={path} />;
  }
}

function DividerLength({ study, point }: { study: Study; point: string }) {
  const p = study.axis.points.find((x) => x.id === point);
  if (!p) return null;
  return (
    <Field label="Mais longa">
      <NumberInput
        ariaLabel="Quanto a divisória passa do comprimento normal"
        value={p.drop}
        decimals={0}
        min={-study.size * 5}
        max={study.size * 80}
        suffix="pt"
        onChange={(drop) => actions.updateStudyPoint(study.id, point, { drop })}
      />
    </Field>
  );
}

/** Which points a parabola meets: two, one where it touches, or none. */
type Meets = "2" | "1" | "0";

function SketchFields({ study, sketch, path }: { study: Study; sketch: StudySketch; path: string }) {
  const id = study.id;
  const change = (patch: Partial<Pick<StudySketch, "shape" | "up" | "roots">>) => actions.updateStudySketch(id, sketch.id, patch);
  const meets = String(sketch.roots.length) as Meets;
  const setMeets = (m: Meets) => {
    const ids = study.axis.points.map((p) => p.id);
    const kept = sketch.roots.slice(0, Number(m));
    const more = ids.filter((x) => !kept.includes(x)).slice(0, Number(m) - kept.length);
    change({ roots: [...kept, ...more] });
  };
  const rootPicker = (slot: number) => (
    <Select
      value={sketch.roots[slot] ?? ""}
      onValueChange={(v) => {
        const roots = [...sketch.roots];
        roots[slot] = v;
        change({ roots });
      }}
    >
      <SelectTrigger className="h-7 w-full" aria-label={slot === 0 ? "Primeiro ponto do esboço" : "Segundo ponto do esboço"}>
        <SelectValue placeholder="Ponto" />
      </SelectTrigger>
      <SelectContent>
        {study.axis.points.map((p) => (
          <SelectItem key={p.id} value={p.id} disabled={sketch.roots.includes(p.id) && sketch.roots[slot] !== p.id}>
            {pointName(study, p.id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <Section title="Esboço">
      <Field label="Nome">
        <PieceText study={study} path={path} label="Nome do esboço" placeholder="como x − 2" />
      </Field>
      <Choice
        label="Forma"
        value={sketch.shape}
        options={[
          { value: "line", label: "Reta" },
          { value: "parabola", label: "Parábola" },
        ]}
        onChange={(shape) => change({ shape })}
      />
      <Choice
        label={sketch.shape === "line" ? "Sentido" : "Boca"}
        value={sketch.up ? "up" : "down"}
        options={
          sketch.shape === "line"
            ? [
                { value: "up", label: "Sobe", title: "Crescente: o coeficiente de x é positivo" },
                { value: "down", label: "Desce", title: "Decrescente: o coeficiente de x é negativo" },
              ]
            : [
                { value: "up", label: "Para cima", title: "a > 0" },
                { value: "down", label: "Para baixo", title: "a < 0" },
              ]
        }
        onChange={(v) => change({ up: v === "up" })}
      />
      {sketch.shape === "parabola" && (
        <Choice
          label="Toca a reta"
          value={meets}
          options={[
            { value: "2", label: "2 pontos", title: "Duas raízes" },
            { value: "1", label: "1 ponto", title: "Uma raiz dupla: encosta na reta" },
            { value: "0", label: "Não toca", title: "Sem raízes reais" },
          ]}
          onChange={setMeets}
        />
      )}
      {sketch.roots.length > 0 && (
        <Field label={sketch.roots.length > 1 ? "Nos pontos" : "No ponto"}>
          <div className="flex w-full gap-1">
            {sketch.roots.map((_, slot) => (
              <div key={slot} className="min-w-0 flex-1">
                {rootPicker(slot)}
              </div>
            ))}
          </div>
        </Field>
      )}
      <Button size="sm" variant="outline" className="mt-1 w-full text-destructive hover:text-destructive" onClick={() => actions.removeStudyPiece(id, path)}>
        <Trash2 /> Remover esboço
      </Button>
    </Section>
  );
}
