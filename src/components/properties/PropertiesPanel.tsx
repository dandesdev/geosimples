import { useEditorStore } from '@/store/useEditorStore';
import { clsx } from 'clsx';
import { Trash2 } from 'lucide-react';
import type { GeometryElement } from '@/geometry/types';
import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

export function PropertiesPanel() {
  const selection = useEditorStore((state) => state.selection);
  const preferences = useEditorStore((state) => state.preferences);
  const elements = useEditorStore((state) => state.elements);
  const removeElements = useEditorStore((state) => state.removeElements);
  const setPreference = useEditorStore((state) => state.setPreference);

  const selectedElements = useMemo(() => {
    return elements.filter((el) => selection.ids.includes(el.id));
  }, [elements, selection.ids]);

  if (selection.type === 'none') {
    return (
      <div className="w-64 border-l border-border bg-background-secondary flex flex-col">
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="tree">Objects</TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="p-4">
            <h3 className="text-sm font-medium text-foreground-muted mb-4">Properties</h3>
            <div className="text-xs text-muted-foreground">
              Select an element to view and edit its properties
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Grid</span>
                <Switch
                  checked={preferences.grid.visible}
                  onCheckedChange={(checked) =>
                    setPreference('grid', { ...preferences.grid, visible: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Axis</span>
                <Switch
                  checked={preferences.axis.visible}
                  onCheckedChange={(checked) =>
                    setPreference('axis', { ...preferences.axis, visible: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Snap to Grid</span>
                <Switch
                  checked={preferences.snapToGrid}
                  onCheckedChange={(checked) =>
                    setPreference('snapToGrid', checked)
                  }
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tree" className="p-4">
            <h3 className="text-sm font-medium text-foreground-muted mb-4">Objects</h3>
            <div className="text-xs text-muted-foreground">
              {elements.length} entities in canvas
            </div>
            {elements.length === 0 && (
              <div className="mt-4 text-xs text-muted-foreground">
                No entities created yet. Use the tools on the left to create points, lines, and shapes.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-border bg-background-secondary flex flex-col">
      <Tabs defaultValue="properties" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 shrink-0">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="tree">Objects</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          <div className="text-sm font-medium">
            {selection.type === 'single' ? '1 element selected' : `${selection.ids.length} elements selected`}
          </div>

          {selectedElements.map((element) => (
            <ElementProperties key={element.id} element={element as GeometryElement} />
          ))}
        </TabsContent>

        <TabsContent value="tree" className="flex-1 overflow-y-auto p-4 mt-0">
          <h3 className="text-sm font-medium text-foreground-muted mb-4">Objects</h3>
          <div className="space-y-1">
            {elements.map((el, index) => (
              <div
                key={el.id}
                className={clsx(
                  'text-sm px-2 py-1 rounded',
                  selection.ids.includes(el.id)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground'
                )}
              >
                {index + 1}. {el.type}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="p-4 border-t border-border shrink-0">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => removeElements(selection.ids)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Selected
        </Button>
      </div>
    </div>
  );
}

function ElementProperties({ element }: { element: GeometryElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  return (
    <div className="space-y-3 border border-border rounded-lg p-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {element.type}
      </div>

      {element.type === 'point' && (
        <>
          <PropertyRow label="X" value={element.x.toFixed(1)} />
          <PropertyRow label="Y" value={element.y.toFixed(1)} />
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Radius</label>
            <Slider
              value={[element.style.radius]}
              onValueChange={([value]) =>
                updateElement(element.id, {
                  style: { ...element.style, radius: value }
                })
              }
              min={2}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
          <ColorProperty
            label="Fill"
            value={element.style.fillColor || '#000000'}
            onChange={(color) =>
              updateElement(element.id, {
                style: { ...element.style, fillColor: color }
              })
            }
          />
          <ColorProperty
            label="Stroke"
            value={element.style.strokeColor}
            onChange={(color) =>
              updateElement(element.id, {
                style: { ...element.style, strokeColor: color }
              })
            }
          />
        </>
      )}

      {element.type === 'line' && (
        <>
          <PropertyRow label="Stroke Width" value={`${element.style.strokeWidth}px`} />
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Width</label>
            <Slider
              value={[element.style.strokeWidth]}
              onValueChange={([value]) =>
                updateElement(element.id, {
                  style: { ...element.style, strokeWidth: value }
                })
              }
              min={0.5}
              max={10}
              step={0.5}
              className="w-full"
            />
          </div>
          <ColorProperty
            label="Stroke"
            value={element.style.strokeColor}
            onChange={(color) =>
              updateElement(element.id, {
                style: { ...element.style, strokeColor: color }
              })
            }
          />
        </>
      )}

      {element.type === 'circle' && (
        <>
          <PropertyRow label="Radius" value={element.radius.toFixed(1)} />
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Radius</label>
            <Slider
              value={[element.radius]}
              onValueChange={([value]) =>
                updateElement(element.id, { radius: value })
              }
              min={5}
              max={200}
              step={5}
              className="w-full"
            />
          </div>
          <ColorProperty
            label="Fill"
            value={element.style.fillColor || '#000000'}
            onChange={(color) =>
              updateElement(element.id, {
                style: { ...element.style, fillColor: color }
              })
            }
          />
          <ColorProperty
            label="Stroke"
            value={element.style.strokeColor}
            onChange={(color) =>
              updateElement(element.id, {
                style: { ...element.style, strokeColor: color }
              })
            }
          />
        </>
      )}
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ColorProperty({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value === 'none' ? '#000000' : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 rounded cursor-pointer border border-border"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 text-xs font-mono"
        />
      </div>
    </div>
  );
}
