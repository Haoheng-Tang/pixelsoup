import type { Editor } from '../../../core';
import type { AppController } from '../../session/app-controller';
import { useEditorRevision } from '../../use-editor-revision';
import { useRevision } from '../../use-revision';
import type { ViewportController } from '../../viewport/viewport-controller';
import { ZoomIndicator } from '../../viewport/ZoomIndicator';
import { LayersIcon, RedoIcon, UndoIcon } from './MobileIcons';

export type MobileSheetId =
  | 'none'
  | 'file'
  | 'edit'
  | 'edit-transform'
  | 'select'
  | 'image'
  | 'menu'
  | 'layers'
  | 'onelayer'
  | 'options';

interface MobileTopBarProps {
  editor: Editor;
  controller: AppController;
  viewport: ViewportController | null;
  activeSheet: MobileSheetId;
  onToggleLayers: () => void;
}

export function MobileTopBar({
  editor,
  controller,
  viewport,
  activeSheet,
  onToggleLayers,
}: MobileTopBarProps) {
  useEditorRevision(editor);
  useRevision(controller);
  useRevision(controller.session);
  const { history } = editor;
  const { session, blocked } = controller;
  const layersOpen = activeSheet === 'layers' || activeSheet === 'onelayer';

  return (
    <header className="mobile-top-bar" data-testid="canvas.topBar">
      <button
        type="button"
        className="mobile-icon-button"
        data-testid="canvas.layersButton"
        aria-label="Layers"
        aria-haspopup="dialog"
        aria-expanded={layersOpen}
        aria-pressed={layersOpen}
        disabled={blocked}
        onClick={onToggleLayers}
      >
        <LayersIcon />
      </button>
      <div className="mobile-title-group" title={session.name}>
        <span className="document-name-text">{session.name}</span>
        {session.isDirty && (
          <span
            className="dirty-marker"
            role="img"
            aria-label="Unsaved changes"
            title="Unsaved changes"
          >
            ●
          </span>
        )}
        <ZoomIndicator viewport={viewport} />
      </div>
      <div className="mobile-history-group" role="group" aria-label="History">
        <button
          type="button"
          className="mobile-icon-button"
          data-testid="canvas.undoButton"
          aria-label="Undo"
          title={history.undoLabel ? `Undo ${history.undoLabel}` : 'Undo'}
          disabled={blocked || !history.canUndo}
          onClick={() => history.undo()}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="mobile-icon-button"
          data-testid="canvas.redoButton"
          aria-label="Redo"
          title={history.redoLabel ? `Redo ${history.redoLabel}` : 'Redo'}
          disabled={blocked || !history.canRedo}
          onClick={() => history.redo()}
        >
          <RedoIcon />
        </button>
      </div>
    </header>
  );
}
