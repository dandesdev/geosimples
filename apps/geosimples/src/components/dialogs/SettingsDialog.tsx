import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import type { PointShape } from "@geosimples/core/figure";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Choice, ColorPicker, Field, NumberInput, RangeField, Section, SwitchField } from "@/components/panel/controls";
import { FillEditor, StrokeEditor } from "@/components/panel/styleEditors";
import { pt } from "@/lib/format";
import { comboFromEvent, comboKeys } from "@/lib/keys";
import { cn } from "@/lib/utils";
import {
  ACTION_LABELS,
  activePrefs,
  applyPrefsToSession,
  DEFAULT_PROFILE_ID,
  DEFAULT_SHORTCUTS,
  DRAFT_NAME,
  hasDraft,
  nextProfileName,
  usePrefsStore,
  type ActionId,
  type Prefs,
} from "@/store/prefsStore";
import { useActivePrefs } from "@/store/useActivePrefs";

/** Marks an input whose Escape key cancels its own edit instead of closing the dialog. */
const OWN_ESCAPE = "data-own-escape";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A fixed height keeps the dialog from resizing between tabs: the tab content scrolls instead. */}
      <DialogContent
        className="flex h-[min(85dvh,720px)] max-w-3xl flex-col gap-3 overflow-hidden"
        onEscapeKeyDown={(e) => {
          if (document.activeElement?.hasAttribute(OWN_ESCAPE)) e.preventDefault();
        }}
      >
        {open && <SettingsBody />}
      </DialogContent>
    </Dialog>
  );
}

/** Lays out one tab's controls; the tab scrolls inside the dialog. */
function TabBody({ children }: { children: ReactNode }) {
  return <div className="space-y-3 pb-1">{children}</div>;
}

/** Tabs share the row and scroll sideways when the dialog is too narrow for their names. */
const TAB = "flex-1 px-2.5 text-xs sm:text-sm";

const TAB_CONTENT = "mt-0 min-h-0 flex-1 overflow-y-auto pr-1 pt-3";

function SettingsBody() {
  const updatePrefs = usePrefsStore((s) => s.updatePrefs);
  const draftActive = usePrefsStore((s) => hasDraft(s));
  const prefs = useActivePrefs();

  /**
   * Saves a change to the active profile. With "Padrão" active it goes to the
   * draft instead. View and export changes also apply to the editor right away.
   */
  const update = (change: (p: Prefs) => Prefs, session = false) => {
    updatePrefs(change);
    if (session) applyPrefsToSession(activePrefs());
  };
  const styles = (change: (s: Prefs["styles"]) => Prefs["styles"]) => update((p) => ({ ...p, styles: change(p.styles) }));
  const behavior = (patch: Partial<Prefs["behavior"]>) =>
    update((p) => ({ ...p, behavior: { ...p.behavior, ...patch } }), true);
  const exporting = (patch: Partial<Prefs["export"]>) => update((p) => ({ ...p, export: { ...p.export, ...patch } }), true);

  return (
    <>
      <DialogHeader className="space-y-2">
        <DialogTitle>Configurações</DialogTitle>
        <ProfileBar />
        <DialogDescription className="sr-only text-xs sm:not-sr-only">
          Padrões para objetos novos, comportamento e atalhos, salvos neste computador. Figuras já feitas não mudam.
        </DialogDescription>
      </DialogHeader>

      {draftActive && <DraftBar />}

      <Tabs defaultValue="styles" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full shrink-0 justify-start overflow-x-auto">
          <TabsTrigger value="styles" className={TAB}>
            Estilos
          </TabsTrigger>
          <TabsTrigger value="behavior" className={TAB}>
            Comportamento
          </TabsTrigger>
          <TabsTrigger value="export" className={TAB}>
            Exportação
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className={TAB}>
            Atalhos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="styles" className={TAB_CONTENT}>
          <TabBody>
            <p className="text-xs text-muted-foreground">Como os objetos novos começam. Cada objeto pode ser mudado depois.</p>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <div className="space-y-3">
                <Section title="Pontos">
                  <Choice<PointShape>
                    label="Destaque"
                    value={prefs.styles.point.shape}
                    options={[
                      { value: "dot", label: "Cheio" },
                      { value: "ring", label: "Vazado" },
                      { value: "none", label: "Oculto" },
                    ]}
                    onChange={(shape) => styles((s) => ({ ...s, point: { ...s.point, shape } }))}
                  />
                  <RangeField
                    label="Tamanho"
                    value={prefs.styles.point.size}
                    min={0.6}
                    max={5}
                    step={0.1}
                    format={pt}
                    onChange={(size) => styles((s) => ({ ...s, point: { ...s.point, size } }))}
                  />
                  <Field label="Cor">
                    <ColorPicker
                      label="Cor dos pontos"
                      value={prefs.styles.point.color}
                      onChange={(color) => styles((s) => ({ ...s, point: { ...s.point, color } }))}
                    />
                  </Field>
                </Section>
                <StrokeEditor
                  title="Traços"
                  stroke={prefs.styles.stroke}
                  onChange={(stroke) => styles((s) => ({ ...s, stroke }))}
                />
                <Section title="Rótulos">
                  <Choice
                    label="Fonte"
                    value={prefs.styles.label.font}
                    options={[
                      { value: "serif", label: "Serifada", title: "Como a fonte padrão do LaTeX" },
                      { value: "sans", label: "Sem serifa" },
                    ]}
                    onChange={(font) => styles((s) => ({ ...s, label: { ...s.label, font } }))}
                  />
                  <RangeField
                    label="Tamanho"
                    value={prefs.styles.label.size}
                    min={6}
                    max={24}
                    step={0.5}
                    format={pt}
                    onChange={(size) => styles((s) => ({ ...s, label: { ...s.label, size } }))}
                  />
                  <Field label="Cor">
                    <ColorPicker
                      label="Cor dos rótulos"
                      value={prefs.styles.label.color}
                      onChange={(color) => styles((s) => ({ ...s, label: { ...s.label, color } }))}
                    />
                  </Field>
                  <RangeField
                    label="Afastamento"
                    value={prefs.styles.label.distance}
                    min={0}
                    max={40}
                    step={0.5}
                    format={pt}
                    onChange={(distance) => styles((s) => ({ ...s, label: { ...s.label, distance } }))}
                  />
                </Section>
              </div>
              <div className="space-y-3">
                <FillEditor
                  switchLabel="Polígonos preenchidos"
                  fill={prefs.styles.polygonFilled ? prefs.styles.fill : null}
                  defaultFill={prefs.styles.fill}
                  onChange={(fill) =>
                    styles((s) => (fill ? { ...s, fill, polygonFilled: true } : { ...s, polygonFilled: false }))
                  }
                />
                <Section title="Ângulos">
                  <RangeField
                    label="Raio"
                    value={prefs.styles.angle.radius}
                    min={6}
                    max={40}
                    step={0.5}
                    format={pt}
                    onChange={(radius) => styles((s) => ({ ...s, angle: { ...s.angle, radius } }))}
                  />
                  <Choice
                    label="Arcos"
                    value={String(prefs.styles.angle.arcs)}
                    options={[
                      { value: "1", label: "1" },
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                    ]}
                    onChange={(n) => styles((s) => ({ ...s, angle: { ...s.angle, arcs: Number(n) as 1 | 2 | 3 } }))}
                  />
                  <SwitchField
                    label="Reto com quadrado"
                    checked={prefs.styles.angle.rightMark}
                    onChange={(rightMark) => styles((s) => ({ ...s, angle: { ...s.angle, rightMark } }))}
                  />
                </Section>
                <FillEditor
                  switchLabel="Ângulos preenchidos"
                  fill={prefs.styles.angle.fill}
                  defaultFill={prefs.styles.fill}
                  onChange={(fill) => styles((s) => ({ ...s, angle: { ...s.angle, fill } }))}
                />
                <Section title="Circunferências">
                  <Field label="Raio inicial">
                    <NumberInput
                      ariaLabel="Raio inicial"
                      value={prefs.styles.circleRadius}
                      min={0.01}
                      max={1e5}
                      onChange={(circleRadius) => styles((s) => ({ ...s, circleRadius }))}
                    />
                  </Field>
                </Section>
              </div>
            </div>
          </TabBody>
        </TabsContent>

        <TabsContent value="behavior" className={TAB_CONTENT}>
          <TabBody>
            <SwitchField
              label="Nomear pontos novos (A, B, C…)"
              checked={prefs.behavior.autoName}
              onChange={(autoName) => behavior({ autoName })}
            />
            <Choice
              label="Ao arrastar"
              value={prefs.behavior.mode}
              options={[
                { value: "select", label: "Selecionar" },
                { value: "pan", label: "Mover a vista" },
                { value: "move", label: "Mover pontos" },
              ]}
              onChange={(mode) => behavior({ mode })}
            />
            <SwitchField
              label="Enquadrar automaticamente"
              checked={prefs.behavior.autoFit}
              onChange={(autoFit) => behavior({ autoFit })}
            />
            <SwitchField label="Mostrar grade" checked={prefs.behavior.showGrid} onChange={(showGrid) => behavior({ showGrid })} />
            <RangeField
              label="Casas decimais nas medidas"
              value={prefs.behavior.decimals}
              min={0}
              max={4}
              step={1}
              format={(n) => String(n)}
              onChange={(decimals) => behavior({ decimals })}
            />
          </TabBody>
        </TabsContent>

        <TabsContent value="export" className={TAB_CONTENT}>
          <TabBody>
            <Field label="1 unidade =">
              <div className="w-36">
                <NumberInput
                  ariaLabel="Centímetros por unidade"
                  value={prefs.export.scale}
                  min={0.1}
                  max={10}
                  suffix="cm"
                  onChange={(scale) => exporting({ scale })}
                />
              </div>
            </Field>
            <Choice
              label="Resolução PNG"
              value={String(prefs.export.dpi)}
              options={[
                { value: "150", label: "150 dpi" },
                { value: "300", label: "300 dpi" },
                { value: "600", label: "600 dpi" },
              ]}
              onChange={(v) => exporting({ dpi: Number(v) })}
            />
            <Choice
              label="Fundo"
              value={prefs.export.background}
              options={[
                { value: "white", label: "Branco" },
                { value: "transparent", label: "Transparente" },
              ]}
              onChange={(background) => exporting({ background })}
            />
          </TabBody>
        </TabsContent>

        <TabsContent value="shortcuts" className={TAB_CONTENT}>
          <TabBody>
            <ShortcutsEditor
              shortcuts={prefs.shortcuts}
              onChange={(shortcuts) => update((p) => ({ ...p, shortcuts }))}
            />
          </TabBody>
        </TabsContent>
      </Tabs>
    </>
  );
}

const FIELD = "h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm text-foreground";

/** Picks the profile in use, with compact new, rename and delete buttons. */
function ProfileBar() {
  const profiles = usePrefsStore((s) => s.profiles);
  const activeId = usePrefsStore((s) => s.activeId);
  const draft = usePrefsStore((s) => s.draft);
  const setActive = usePrefsStore((s) => s.setActive);
  const createProfile = usePrefsStore((s) => s.createProfile);
  const renameProfile = usePrefsStore((s) => s.renameProfile);
  const deleteProfile = usePrefsStore((s) => s.deleteProfile);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const active = profiles.find((p) => p.id === activeId);

  const newProfile = () => {
    const name = nextProfileName(profiles);
    createProfile(name);
    toast.success(`"${name}" criada como cópia da atual e já está em uso.`);
  };

  return (
    <div className="flex items-center gap-1">
      {renaming && active ? (
        <input
          autoFocus
          aria-label="Nome da configuração"
          defaultValue={active.name}
          maxLength={60}
          {...{ [OWN_ESCAPE]: "" }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            renameProfile(active.id, e.target.value);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = active.name;
              e.currentTarget.blur();
            }
          }}
          className={FIELD}
        />
      ) : (
        <select
          aria-label="Configuração em uso"
          value={activeId}
          onChange={(e) => setActive(e.target.value)}
          className={FIELD}
        >
          <option value={DEFAULT_PROFILE_ID}>{draft ? DRAFT_NAME : "Padrão"}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <IconButton label="Nova configuração" hint="Cria uma cópia da configuração atual." onClick={newProfile}>
        <Plus />
      </IconButton>
      {active && (
        <>
          <IconButton label="Renomear" onClick={() => setRenaming(true)}>
            <Pencil />
          </IconButton>
          <IconButton
            label="Excluir configuração"
            className="hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </IconButton>
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{active?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>A configuração Padrão volta a ser usada. Suas figuras não mudam.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => active && deleteProfile(active.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Shown while "Padrão" has unsaved changes: save them as a new profile or drop them. */
function DraftBar() {
  const profiles = usePrefsStore((s) => s.profiles);
  const createProfile = usePrefsStore((s) => s.createProfile);
  const discardDraft = usePrefsStore((s) => s.discardDraft);
  const [name, setName] = useState(() => nextProfileName(profiles));

  const save = () => {
    const finalName = name.trim() || nextProfileName(profiles);
    createProfile(finalName);
    toast.success(`"${finalName}" salva e em uso.`);
  };

  const discard = () => {
    const dropped = usePrefsStore.getState().draft;
    discardDraft();
    toast("Alterações descartadas. A Padrão voltou a valer.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          if (!dropped || usePrefsStore.getState().activeId !== DEFAULT_PROFILE_ID) return;
          usePrefsStore.setState({ draft: dropped });
          applyPrefsToSession(dropped);
        },
      },
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2"
    >
      <p className="w-full px-1 text-xs text-muted-foreground">
        Você alterou a Padrão. As mudanças já valem para objetos novos, mas a Padrão não muda: salve-as como uma nova
        configuração ou descarte.
      </p>
      <input
        aria-label="Nome da nova configuração"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        className={cn(FIELD, "h-8 min-w-40")}
      />
      <Button type="submit" size="sm">
        <Save />
        Salvar como nova configuração
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={discard}>
        <Undo2 />
        Descartar alterações
      </Button>
    </form>
  );
}

function ShortcutsEditor({
  shortcuts,
  onChange,
}: {
  shortcuts: Record<ActionId, string[]>;
  onChange: (s: Record<ActionId, string[]>) => void;
}) {
  const [recording, setRecording] = useState<ActionId | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      const owner = (Object.keys(shortcuts) as ActionId[]).find((id) => id !== recording && shortcuts[id].includes(combo));
      const next = { ...shortcuts };
      if (owner) {
        next[owner] = next[owner].filter((c) => c !== combo);
        toast(`${combo} saiu de "${ACTION_LABELS[owner]}".`);
      }
      if (!next[recording].includes(combo)) next[recording] = [...next[recording], combo];
      onChange(next);
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, shortcuts, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Clique em + e pressione a combinação. Esc cancela. Arrastar com o botão do meio sempre move a vista.
        </p>
        <Button size="sm" variant="outline" onClick={() => onChange(DEFAULT_SHORTCUTS)}>
          <RotateCcw />
          Restaurar padrões
        </Button>
      </div>
      <div className="divide-y rounded-md border">
        {(Object.keys(ACTION_LABELS) as ActionId[]).map((id) => (
          <div key={id} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="text-sm">{ACTION_LABELS[id]}</span>
            <div className="flex flex-wrap items-center justify-end gap-1">
              {shortcuts[id].map((combo) => (
                <span key={combo} className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 py-0.5 pl-1.5 pr-0.5">
                  {comboKeys(combo).map((k, i) => (
                    <kbd key={i} className="font-mono text-xs">
                      {i > 0 ? "+" : ""}
                      {k}
                    </kbd>
                  ))}
                  <button
                    type="button"
                    aria-label={`Remover ${combo}`}
                    className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...shortcuts, [id]: shortcuts[id].filter((c) => c !== combo) })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Button
                size="sm"
                variant={recording === id ? "default" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setRecording(recording === id ? null : id)}
              >
                {recording === id ? "Pressione…" : <Plus />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
