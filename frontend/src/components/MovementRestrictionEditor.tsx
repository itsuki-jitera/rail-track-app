/**
 * 移動量制限箇所エディタコンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P14に基づく実装
 * - 不動点や移動量制限箇所の新規入力・更新
 * - 作業方向順の入力
 * - 左右方向、上下方向の制限設定
 */

import React, { useState, useCallback, useEffect } from 'react';
import './MovementRestrictionEditor.css';

interface MovementRestriction {
  id: string;
  startKm: number;      // 開始キロ程 (m単位)
  endKm: number;        // 終了キロ程 (m単位)
  direction: 'left' | 'right' | 'both' | 'vertical';  // 制限方向
  restrictionAmount: number;  // 制限量 (mm)
  isFixed: boolean;     // 不動点フラグ
  notes?: string;       // 備考
}

interface MovementRestrictionEditorProps {
  restrictions?: MovementRestriction[];
  workDirection?: 'up' | 'down';
  onRestrictionsChange?: (restrictions: MovementRestriction[]) => void;
  maxRestrictions?: number;
}

const MovementRestrictionEditor: React.FC<MovementRestrictionEditorProps> = ({
  restrictions: initialRestrictions = [],
  workDirection = 'up',
  onRestrictionsChange,
  maxRestrictions = 50
}) => {
  const [restrictions, setRestrictions] = useState<MovementRestriction[]>(initialRestrictions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRestriction, setNewRestriction] = useState<Partial<MovementRestriction>>({
    direction: 'both',
    restrictionAmount: 0,
    isFixed: false
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showImportDialog, setShowImportDialog] = useState(false);

  // 作業方向順のソート
  const sortByWorkDirection = useCallback((items: MovementRestriction[]) => {
    return [...items].sort((a, b) => {
      if (workDirection === 'up') {
        return a.startKm - b.startKm;
      } else {
        return b.startKm - a.startKm;
      }
    });
  }, [workDirection]);

  // 制限箇所の追加
  const addRestriction = useCallback(() => {
    const errors: Record<string, string> = {};

    // バリデーション
    if (!newRestriction.startKm) {
      errors.startKm = '開始キロ程を入力してください';
    }
    if (!newRestriction.endKm) {
      errors.endKm = '終了キロ程を入力してください';
    }
    if (newRestriction.startKm && newRestriction.endKm &&
        newRestriction.startKm >= newRestriction.endKm) {
      errors.range = '開始キロ程は終了キロ程より小さくしてください';
    }

    // 重複チェック
    const hasOverlap = restrictions.some(r =>
      (newRestriction.startKm! >= r.startKm && newRestriction.startKm! <= r.endKm) ||
      (newRestriction.endKm! >= r.startKm && newRestriction.endKm! <= r.endKm)
    );

    if (hasOverlap) {
      errors.overlap = '既存の制限区間と重複しています';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const restriction: MovementRestriction = {
      id: `restriction-${Date.now()}`,
      startKm: newRestriction.startKm!,
      endKm: newRestriction.endKm!,
      direction: newRestriction.direction || 'both',
      restrictionAmount: newRestriction.restrictionAmount || 0,
      isFixed: newRestriction.isFixed || false,
      notes: newRestriction.notes
    };

    const updatedRestrictions = sortByWorkDirection([...restrictions, restriction]);
    setRestrictions(updatedRestrictions);

    // リセット
    setNewRestriction({
      direction: 'both',
      restrictionAmount: 0,
      isFixed: false
    });
    setValidationErrors({});

    if (onRestrictionsChange) {
      onRestrictionsChange(updatedRestrictions);
    }
  }, [newRestriction, restrictions, sortByWorkDirection, onRestrictionsChange]);

  // 制限箇所の削除
  const deleteRestriction = useCallback((id: string) => {
    const updatedRestrictions = restrictions.filter(r => r.id !== id);
    setRestrictions(updatedRestrictions);

    if (onRestrictionsChange) {
      onRestrictionsChange(updatedRestrictions);
    }
  }, [restrictions, onRestrictionsChange]);

  // 制限箇所の更新
  const updateRestriction = useCallback((id: string, updates: Partial<MovementRestriction>) => {
    const updatedRestrictions = restrictions.map(r =>
      r.id === id ? { ...r, ...updates } : r
    );

    const sortedRestrictions = sortByWorkDirection(updatedRestrictions);
    setRestrictions(sortedRestrictions);

    if (onRestrictionsChange) {
      onRestrictionsChange(sortedRestrictions);
    }
  }, [restrictions, sortByWorkDirection, onRestrictionsChange]);

  // CSVインポート
  const importFromCSV = useCallback((csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    const importedRestrictions: MovementRestriction[] = [];

    // ヘッダー行をスキップ
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());

      if (parts.length >= 4) {
        const startKm = parseFloat(parts[0]);
        const endKm = parseFloat(parts[1]);
        const directionCode = parseInt(parts[2]);
        const amount = parseFloat(parts[3]);

        if (!isNaN(startKm) && !isNaN(endKm) && !isNaN(amount)) {
          importedRestrictions.push({
            id: `restriction-${Date.now()}-${i}`,
            startKm,
            endKm,
            direction: directionCode === 1 ? 'left' : directionCode === 2 ? 'right' : 'both',
            restrictionAmount: amount,
            isFixed: amount === 0,
            notes: parts[4] || ''
          });
        }
      }
    }

    const sortedRestrictions = sortByWorkDirection(importedRestrictions);
    setRestrictions(sortedRestrictions);

    if (onRestrictionsChange) {
      onRestrictionsChange(sortedRestrictions);
    }

    setShowImportDialog(false);
  }, [sortByWorkDirection, onRestrictionsChange]);

  // CSVエクスポート
  const exportToCSV = useCallback(() => {
    const headers = '開始キロ程,終了キロ程,方向,制限量,備考';
    const rows = restrictions.map(r => {
      const directionCode = r.direction === 'left' ? 1 : r.direction === 'right' ? 2 : 0;
      return `${r.startKm},${r.endKm},${directionCode},${r.restrictionAmount},${r.notes || ''}`;
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `movement_restrictions_${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [restrictions]);

  // 制限量の可視化用クラス
  const getRestrictionClass = (amount: number, isFixed: boolean) => {
    if (isFixed) return 'fixed-point';
    if (amount === 0) return 'no-movement';
    if (amount <= 5) return 'small-restriction';
    if (amount <= 10) return 'medium-restriction';
    return 'large-restriction';
  };

  // 作業方向が変更されたら再ソート
  useEffect(() => {
    setRestrictions(prev => sortByWorkDirection(prev));
  }, [workDirection, sortByWorkDirection]);

  return (
    <div className="movement-restriction-editor">
      <div className="editor-header">
        <h3>移動量制限箇所管理</h3>
        <div className="header-info">
          <span className="work-direction-indicator">
            作業方向: {workDirection === 'up' ? '上り' : '下り'}
          </span>
          <span className="restriction-count">
            制限箇所数: {restrictions.length} / {maxRestrictions}
          </span>
        </div>
      </div>

      {/* 新規入力フォーム */}
      <div className="input-form">
        <h4>新規制限箇所入力</h4>
        <div className="form-grid">
          <div className="form-group">
            <label>開始キロ程 (m)</label>
            <input
              type="number"
              value={newRestriction.startKm || ''}
              onChange={e => setNewRestriction({
                ...newRestriction,
                startKm: parseFloat(e.target.value)
              })}
              placeholder="例: 540120"
            />
            {validationErrors.startKm && (
              <span className="error">{validationErrors.startKm}</span>
            )}
          </div>

          <div className="form-group">
            <label>終了キロ程 (m)</label>
            <input
              type="number"
              value={newRestriction.endKm || ''}
              onChange={e => setNewRestriction({
                ...newRestriction,
                endKm: parseFloat(e.target.value)
              })}
              placeholder="例: 540150"
            />
            {validationErrors.endKm && (
              <span className="error">{validationErrors.endKm}</span>
            )}
          </div>

          <div className="form-group">
            <label>制限方向</label>
            <select
              value={newRestriction.direction}
              onChange={e => setNewRestriction({
                ...newRestriction,
                direction: e.target.value as MovementRestriction['direction']
              })}
            >
              <option value="both">左右両方</option>
              <option value="left">左のみ</option>
              <option value="right">右のみ</option>
              <option value="vertical">上下方向</option>
            </select>
          </div>

          <div className="form-group">
            <label>制限量 (mm)</label>
            <input
              type="number"
              value={newRestriction.restrictionAmount || ''}
              onChange={e => setNewRestriction({
                ...newRestriction,
                restrictionAmount: parseFloat(e.target.value)
              })}
              placeholder="0: 不動点"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={newRestriction.isFixed || false}
                onChange={e => setNewRestriction({
                  ...newRestriction,
                  isFixed: e.target.checked,
                  restrictionAmount: e.target.checked ? 0 : newRestriction.restrictionAmount
                })}
              />
              不動点
            </label>
          </div>

          <div className="form-group full-width">
            <label>備考</label>
            <input
              type="text"
              value={newRestriction.notes || ''}
              onChange={e => setNewRestriction({
                ...newRestriction,
                notes: e.target.value
              })}
              placeholder="橋梁、分岐器など"
            />
          </div>
        </div>

        {validationErrors.range && (
          <div className="error-message">{validationErrors.range}</div>
        )}
        {validationErrors.overlap && (
          <div className="error-message">{validationErrors.overlap}</div>
        )}

        <div className="form-actions">
          <button
            onClick={addRestriction}
            disabled={restrictions.length >= maxRestrictions}
            className="btn-primary"
          >
            追加
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="btn-secondary"
          >
            CSVインポート
          </button>
          <button
            onClick={exportToCSV}
            disabled={restrictions.length === 0}
            className="btn-secondary"
          >
            CSVエクスポート
          </button>
        </div>
      </div>

      {/* 制限箇所リスト */}
      <div className="restrictions-list">
        <h4>登録済み制限箇所</h4>

        {restrictions.length === 0 ? (
          <div className="no-restrictions">
            制限箇所が登録されていません
          </div>
        ) : (
          <div className="restriction-items">
            {restrictions.map(restriction => (
              <div
                key={restriction.id}
                className={`restriction-item ${getRestrictionClass(
                  restriction.restrictionAmount,
                  restriction.isFixed
                )}`}
              >
                <div className="restriction-info">
                  <span className="km-range">
                    {(restriction.startKm / 1000).toFixed(3)} km ～
                    {(restriction.endKm / 1000).toFixed(3)} km
                  </span>
                  <span className="direction-badge">
                    {restriction.direction === 'both' ? '左右' :
                     restriction.direction === 'vertical' ? '上下' :
                     restriction.direction === 'left' ? '左' : '右'}
                  </span>
                  <span className="restriction-amount">
                    {restriction.isFixed ? '不動点' : `${restriction.restrictionAmount}mm`}
                  </span>
                  {restriction.notes && (
                    <span className="notes">{restriction.notes}</span>
                  )}
                </div>

                {editingId === restriction.id ? (
                  <div className="edit-form">
                    <input
                      type="number"
                      value={restriction.restrictionAmount}
                      onChange={e => updateRestriction(restriction.id, {
                        restrictionAmount: parseFloat(e.target.value)
                      })}
                    />
                    <button onClick={() => setEditingId(null)}>保存</button>
                  </div>
                ) : (
                  <div className="restriction-actions">
                    <button
                      onClick={() => setEditingId(restriction.id)}
                      className="btn-edit"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteRestriction(restriction.id)}
                      className="btn-delete"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSVインポートダイアログ */}
      {showImportDialog && (
        <div className="import-dialog-overlay">
          <div className="import-dialog">
            <h4>CSVインポート</h4>
            <p>CSV形式: 開始キロ程,終了キロ程,方向(0:両方,1:左,2:右),制限量,備考</p>
            <textarea
              placeholder="CSVデータを貼り付けてください"
              onPaste={e => {
                const csvContent = e.clipboardData.getData('text');
                importFromCSV(csvContent);
              }}
            />
            <div className="dialog-actions">
              <button onClick={() => setShowImportDialog(false)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovementRestrictionEditor;