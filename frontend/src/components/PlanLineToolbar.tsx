/**
 * 計画線編集ツールバー
 * Plan Line Editing Toolbar
 */

import React from 'react';

export type EditMode = 'view' | 'edit-drag' | 'edit-add' | 'edit-delete' | 'edit-straight' | 'edit-curve';

interface PlanLineToolbarProps {
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSmooth: () => void;
  onReset: () => void;
  onSave?: () => void;
  onExport?: (format: 'csv' | 'json') => void;
  onImport?: (file: File) => void;
  canUndo: boolean;
  canRedo: boolean;
  pointCount: number;
  historyPosition: string;
  isProcessing?: boolean;
}

export const PlanLineToolbar: React.FC<PlanLineToolbarProps> = ({
  editMode,
  onEditModeChange,
  onUndo,
  onRedo,
  onSmooth,
  onReset,
  onSave,
  onExport,
  onImport,
  canUndo,
  canRedo,
  pointCount,
  historyPosition,
  isProcessing = false
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  return (
    <div className="plan-line-toolbar">
      {/* 編集モード選択 */}
      <div className="toolbar-section">
        <h3>編集モード</h3>
        <div className="button-group">
          <button
            className={`mode-btn primary-mode ${editMode === 'edit-drag' ? 'active' : ''}`}
            onClick={() => onEditModeChange('edit-drag')}
            title="ドラッグモード（デフォルト） - 計画線を直接ドラッグで編集"
            disabled={isProcessing}
          >
            <span className="icon">✋</span>
            <span className="label">ドラッグ</span>
          </button>

          <button
            className={`mode-btn ${editMode === 'edit-add' ? 'active' : ''}`}
            onClick={() => onEditModeChange('edit-add')}
            title="追加モード - クリックでポイント追加"
            disabled={isProcessing}
          >
            <span className="icon">➕</span>
            <span className="label">追加</span>
          </button>

          <button
            className={`mode-btn ${editMode === 'edit-delete' ? 'active' : ''}`}
            onClick={() => onEditModeChange('edit-delete')}
            title="削除モード - ポイントをクリックして削除"
            disabled={isProcessing}
          >
            <span className="icon">🗑️</span>
            <span className="label">削除</span>
          </button>

          <button
            className={`mode-btn ${editMode === 'edit-straight' ? 'active' : ''}`}
            onClick={() => onEditModeChange('edit-straight')}
            title="直線モード - 区間を直線に設定"
            disabled={isProcessing}
          >
            <span className="icon">📏</span>
            <span className="label">直線</span>
          </button>

          <button
            className={`mode-btn ${editMode === 'edit-curve' ? 'active' : ''}`}
            onClick={() => onEditModeChange('edit-curve')}
            title="曲線モード - 区間を曲線に設定"
            disabled={isProcessing}
          >
            <span className="icon">〰️</span>
            <span className="label">曲線</span>
          </button>

          <button
            className={`mode-btn ${editMode === 'view' ? 'active' : ''}`}
            onClick={() => onEditModeChange('view')}
            title="表示モード - 編集を無効化（読み取り専用）"
            disabled={isProcessing}
          >
            <span className="icon">👁️</span>
            <span className="label">表示のみ</span>
          </button>
        </div>
      </div>

      {/* 編集操作 */}
      <div className="toolbar-section">
        <h3>編集操作</h3>
        <div className="button-group">
          <button
            className="action-btn"
            onClick={onUndo}
            disabled={!canUndo || isProcessing}
            title="元に戻す (Ctrl+Z)"
          >
            <span className="icon">↶</span>
            <span className="label">Undo</span>
          </button>

          <button
            className="action-btn"
            onClick={onRedo}
            disabled={!canRedo || isProcessing}
            title="やり直し (Ctrl+Y)"
          >
            <span className="icon">↷</span>
            <span className="label">Redo</span>
          </button>

          <button
            className="action-btn"
            onClick={onSmooth}
            disabled={pointCount < 3 || isProcessing}
            title="計画線を平滑化"
          >
            <span className="icon">✨</span>
            <span className="label">平滑化</span>
          </button>

          <button
            className="action-btn danger"
            onClick={onReset}
            disabled={isProcessing}
            title="元の計画線にリセット"
          >
            <span className="icon">🔄</span>
            <span className="label">リセット</span>
          </button>

          {onSave && (
            <button
              className="action-btn primary"
              onClick={onSave}
              disabled={isProcessing}
              title="計画線を保存"
            >
              <span className="icon">💾</span>
              <span className="label">保存</span>
            </button>
          )}
        </div>
      </div>

      {/* データ入出力 */}
      {(onExport || onImport) && (
        <div className="toolbar-section">
          <h3>データ入出力</h3>
          <div className="button-group">
            {onExport && (
              <>
                <button
                  className="action-btn"
                  onClick={() => onExport('csv')}
                  disabled={pointCount === 0 || isProcessing}
                  title="計画線をCSV形式でエクスポート"
                >
                  <span className="icon">📄</span>
                  <span className="label">CSV出力</span>
                </button>

                <button
                  className="action-btn"
                  onClick={() => onExport('json')}
                  disabled={pointCount === 0 || isProcessing}
                  title="計画線をJSON形式でエクスポート"
                >
                  <span className="icon">📋</span>
                  <span className="label">JSON出力</span>
                </button>
              </>
            )}

            {onImport && (
              <>
                <button
                  className="action-btn"
                  onClick={handleImportClick}
                  disabled={isProcessing}
                  title="CSV/JSONファイルから計画線をインポート"
                >
                  <span className="icon">📁</span>
                  <span className="label">インポート</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* 情報表示 */}
      <div className="toolbar-section">
        <h3>情報</h3>
        <div className="info-display">
          <div className="info-item">
            <span className="info-label">ポイント数:</span>
            <span className="info-value">{pointCount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">履歴:</span>
            <span className="info-value">{historyPosition}</span>
          </div>
          {isProcessing && (
            <div className="info-item">
              <span className="processing-indicator">⏳ 処理中...</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .plan-line-toolbar {
          display: flex;
          gap: 20px;
          padding: 16px;
          background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .toolbar-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .toolbar-section h3 {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .button-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .mode-btn, .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #374151;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 70px;
        }

        .mode-btn .icon, .action-btn .icon {
          font-size: 20px;
        }

        .mode-btn .label, .action-btn .label {
          font-size: 11px;
        }

        .mode-btn:hover:not(:disabled), .action-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .mode-btn.active {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border-color: #3b82f6;
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
        }

        .mode-btn.primary-mode {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
        }

        .mode-btn.primary-mode.active {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border-color: #3b82f6;
          box-shadow: 0 6px 12px rgba(59, 130, 246, 0.4);
          transform: scale(1.05);
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border-color: #10b981;
        }

        .action-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669, #047857);
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
        }

        .action-btn.danger {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          border-color: #ef4444;
        }

        .action-btn.danger:hover:not(:disabled) {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
        }

        .mode-btn:disabled, .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
        }

        .info-display {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 14px;
          background: white;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          min-width: 150px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .info-label {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
        }

        .info-value {
          font-size: 13px;
          color: #1f2937;
          font-weight: 700;
          padding: 2px 8px;
          background: #f3f4f6;
          border-radius: 4px;
        }

        .processing-indicator {
          font-size: 12px;
          color: #3b82f6;
          font-weight: 600;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default PlanLineToolbar;
