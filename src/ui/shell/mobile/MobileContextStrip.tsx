import { useCallback, useState, useSyncExternalStore } from 'react';
import type { Editor } from '../../../core';
import { toHex } from '../../color/color-math';
import type { Colors } from '../../color/colors';
import {
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  sizeToSlider,
  sliderToSize,
} from '../../tools/brush-options';
import type { CropAspect, CropOptions } from '../../tools/crop-options';
import { CropTool } from '../../tools/crop-tool';
import type { EyedropperOptions, SampleSource } from '../../tools/eyedropper-options';
import { EyedropperTool } from '../../tools/eyedropper-tool';
import { LassoTool, PolygonLassoTool } from '../../tools/lasso-tool';
import { MagicWandTool } from '../../tools/magic-wand-tool';
import { MarqueeTool } from '../../tools/marquee-tool';
import { NumberSlider } from '../../tools/NumberSlider';
import { CANCEL_ICON, COMMIT_ICON, OptionsIcon } from '../../tools/OptionsIcon';
import { PaintBucketTool } from '../../tools/paint-bucket-tool';
import { PaintTool } from '../../tools/paint-tool';
import type { RegionOptions } from '../../tools/region-options';
import { SelectionOptionsPanel } from '../../tools/SelectionOptionsPanel';
import type { ToolManager } from '../../tools/tool-manager';
import { useActiveTool, useToolOptionsName } from '../../tools/use-active-tool';
import type { FreeTransform } from '../../transform/free-transform';
import { fieldText, parseFieldText, transformFields } from '../../transform/transform-math';
import type { TransformSession } from '../../transform/transform-session';
import { useEditorRevision } from '../../use-editor-revision';
import { useRevision } from '../../use-revision';
import { SlidersIcon } from './MobileIcons';

const SIZE_SLIDER_STEPS = 1000;

const CROP_ASPECTS: readonly { aspect: CropAspect; label: string }[] = [
  { aspect: 'free', label: 'Free' },
  { aspect: 'original', label: 'Original' },
  { aspect: '1:1', label: '1:1' },
  { aspect: '4:3', label: '4:3' },
  { aspect: '3:2', label: '3:2' },
  { aspect: '16:9', label: '16:9' },
  { aspect: 'custom', label: 'Custom' },
];

const EYEDROPPER_SOURCES: readonly { source: SampleSource; label: string }[] = [
  { source: 'composite', label: 'All' },
  { source: 'layer', label: 'Layer' },
];

function isCropAspect(value: string): value is CropAspect {
  return CROP_ASPECTS.some(({ aspect }) => aspect === value);
}

interface MobileContextStripProps {
  editor: Editor;
  tools: ToolManager;
  freeTransform: FreeTransform;
  colors: Colors;
  optionsOpen: boolean;
  onToggleOptions: () => void;
}

/**
 * Compact contextual strip directly above the mobile tool strip showing 1–2 primary
 * controls for the active tool or Free Transform session, plus a "More" button that
 * opens the full tool options and colour picker sheet.
 */
export function MobileContextStrip({
  editor,
  tools,
  freeTransform,
  colors,
  optionsOpen,
  onToggleOptions,
}: MobileContextStripProps) {
  useEditorRevision(editor);
  useRevision(colors);
  const activeTool = useActiveTool(tools);
  const optionsName = useToolOptionsName(tools);
  const subscribeTransform = useCallback(
    (notify: () => void) => freeTransform.subscribe(notify),
    [freeTransform],
  );
  const session = useSyncExternalStore(subscribeTransform, () => freeTransform.session);
  const fgHex = toHex(colors.foreground);

  return (
    <div
      className="mobile-context-strip"
      data-testid="canvas.contextStrip"
      role="group"
      aria-label={`${optionsName} quick options`}
    >
      <div className="mobile-context-primary">
        {session ? (
          <TransformQuickControls session={session} />
        ) : activeTool instanceof PaintTool ? (
          <BrushQuickControls
            tool={activeTool}
            fgHex={fgHex}
            showSwatch={activeTool.mode === 'paint'}
            onOpenColors={onToggleOptions}
          />
        ) : activeTool instanceof MarqueeTool ||
          activeTool instanceof LassoTool ||
          activeTool instanceof PolygonLassoTool ? (
          <SelectionOptionsPanel options={activeTool.options} />
        ) : activeTool instanceof CropTool ? (
          <CropQuickControls tool={activeTool} options={activeTool.options} />
        ) : activeTool instanceof MagicWandTool ? (
          <RegionQuickControls
            options={activeTool.options}
            fgHex={fgHex}
            showSwatch={false}
            onOpenColors={onToggleOptions}
          />
        ) : activeTool instanceof PaintBucketTool ? (
          <RegionQuickControls
            options={activeTool.options}
            fgHex={fgHex}
            showSwatch={true}
            onOpenColors={onToggleOptions}
          />
        ) : activeTool instanceof EyedropperTool ? (
          <EyedropperQuickControls
            options={activeTool.options}
            fgHex={fgHex}
            onOpenColors={onToggleOptions}
          />
        ) : (
          <span className="mobile-context-label">
            {editor.activeLayer ? `Move: ${editor.activeLayer.name}` : 'Move'}
          </span>
        )}
      </div>
      <button
        type="button"
        className="mobile-more-button"
        data-testid="canvas.moreOptionsButton"
        aria-label="More tool options"
        aria-haspopup="dialog"
        aria-expanded={optionsOpen}
        aria-pressed={optionsOpen}
        onClick={onToggleOptions}
      >
        <SlidersIcon />
        <span>More</span>
      </button>
    </div>
  );
}

function BrushQuickControls({
  tool,
  fgHex,
  showSwatch,
  onOpenColors,
}: {
  tool: PaintTool;
  fgHex: string;
  showSwatch: boolean;
  onOpenColors: () => void;
}) {
  const settings = useSyncExternalStore(tool.options.subscribe, () => tool.options.settings);
  return (
    <>
      {showSwatch && (
        <button
          type="button"
          className="mobile-quick-swatch"
          data-testid="canvas.colorSwatch"
          style={{ backgroundColor: fgHex }}
          aria-label={`Foreground colour ${fgHex}`}
          onClick={onOpenColors}
        />
      )}
      <NumberSlider
        label="Size"
        unit="px"
        value={settings.size}
        min={MIN_BRUSH_SIZE}
        max={MAX_BRUSH_SIZE}
        slider={{
          max: SIZE_SLIDER_STEPS,
          toPosition: (size) => Math.round(sizeToSlider(size) * SIZE_SLIDER_STEPS),
          fromPosition: (position) => sliderToSize(position / SIZE_SLIDER_STEPS),
        }}
        onChange={(size) => tool.options.set({ size })}
      />
    </>
  );
}

function RegionQuickControls({
  options,
  fgHex,
  showSwatch,
  onOpenColors,
}: {
  options: RegionOptions;
  fgHex: string;
  showSwatch: boolean;
  onOpenColors: () => void;
}) {
  const settings = useSyncExternalStore(options.subscribe, () => options.settings);
  return (
    <>
      {showSwatch && (
        <button
          type="button"
          className="mobile-quick-swatch"
          data-testid="canvas.colorSwatch"
          style={{ backgroundColor: fgHex }}
          aria-label={`Foreground colour ${fgHex}`}
          onClick={onOpenColors}
        />
      )}
      <NumberSlider
        label="Tol"
        unit=""
        value={settings.tolerance}
        min={0}
        max={255}
        onChange={(tolerance) => options.set({ tolerance })}
      />
    </>
  );
}

function EyedropperQuickControls({
  options,
  fgHex,
  onOpenColors,
}: {
  options: EyedropperOptions;
  fgHex: string;
  onOpenColors: () => void;
}) {
  const current = useSyncExternalStore(options.subscribe, () => options.source);
  return (
    <>
      <button
        type="button"
        className="mobile-quick-swatch"
        data-testid="canvas.colorSwatch"
        style={{ backgroundColor: fgHex }}
        aria-label={`Foreground colour ${fgHex}`}
        onClick={onOpenColors}
      />
      <div className="toolbar-group segmented" role="group" aria-label="Sample source">
        {EYEDROPPER_SOURCES.map(({ source, label }) => (
          <button
            key={source}
            type="button"
            aria-pressed={source === current}
            onClick={() => options.setSource(source)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function CropQuickControls({ tool, options }: { tool: CropTool; options: CropOptions }) {
  const settings = useSyncExternalStore(options.subscribe, () => options.settings);
  const canCommit = useSyncExternalStore(tool.subscribe, () => tool.canCommit);
  const canReset = useSyncExternalStore(tool.subscribe, () => tool.canReset);
  return (
    <>
      <label className="options-field">
        <span className="options-label">Ratio</span>
        <select
          className="options-select"
          aria-label="Crop ratio"
          value={settings.aspect}
          onChange={(e) => {
            if (isCropAspect(e.target.value)) options.set({ aspect: e.target.value });
          }}
        >
          {CROP_ASPECTS.map(({ aspect, label }) => (
            <option key={aspect} value={aspect}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="toolbar-group">
        <button
          type="button"
          className="options-icon-button"
          data-testid="canvas.applyButton"
          aria-label="Commit crop"
          disabled={!canCommit}
          onClick={() => tool.commit()}
        >
          <OptionsIcon d={COMMIT_ICON} />
        </button>
        <button
          type="button"
          className="options-icon-button"
          data-testid="canvas.cancelButton"
          aria-label="Cancel crop"
          disabled={!canReset}
          onClick={() => tool.resetBox()}
        >
          <OptionsIcon d={CANCEL_ICON} />
        </button>
      </div>
    </>
  );
}

function TransformQuickControls({ session }: { session: TransformSession }) {
  const subscribe = useCallback((notify: () => void) => session.subscribe(notify), [session]);
  const state = useSyncExternalStore(subscribe, () => session.state);
  const fields = transformFields(session.source.rect, state, 'percent');
  const [angleText, setAngleText] = useState<string | null>(null);
  const angleDisabled = fields.angle === null;
  const shownAngle = angleDisabled ? '' : (angleText ?? fieldText(fields.angle));

  return (
    <>
      <span className="mobile-context-label">{session.name}</span>
      <label className="options-field">
        <span className="options-label">∠</span>
        <input
          type="text"
          inputMode="decimal"
          className="options-number"
          aria-label="Angle"
          disabled={angleDisabled}
          value={shownAngle}
          onChange={(e) => {
            setAngleText(e.target.value);
            const parsed = parseFieldText(e.target.value);
            if (parsed !== null) session.setField('angle', parsed);
          }}
          onBlur={() => setAngleText(null)}
        />
        <span className="options-unit" aria-hidden="true">
          °
        </span>
      </label>
      <div className="toolbar-group">
        <button
          type="button"
          className="options-icon-button"
          data-testid="canvas.applyButton"
          aria-label="Apply transform"
          onClick={() => session.apply()}
        >
          <OptionsIcon d={COMMIT_ICON} />
        </button>
        <button
          type="button"
          className="options-icon-button"
          data-testid="canvas.cancelButton"
          aria-label="Cancel transform"
          onClick={() => session.discard()}
        >
          <OptionsIcon d={CANCEL_ICON} />
        </button>
      </div>
    </>
  );
}
