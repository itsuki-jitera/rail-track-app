/**
 * 曲線諸元エディタコンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P19-20に基づく実装
 * - 平面曲線諸元の入力・修正
 * - 正矢計算（L²/(8R)）
 * - 緩和曲線のD/6補正
 * - 台形差引の視覚化
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import './CurveElementEditor.css';

interface CurveElement {
  id: string;
  startKm: number;         // 開始キロ程 (m)
  endKm: number;          // 終了キロ程 (m)
  radius: number;         // 半径 (m)
  direction: 'left' | 'right';
  type: 'circular' | 'transition' | 'compound';
  transitionLength?: number;  // 緩和曲線長 (m)
  cant?: number;          // カント (mm)
  speed?: number;         // 設計速度 (km/h)
  notes?: string;
}

interface TrapezoidVisualization {
  position: number;
  theoreticalVersine: number;
  actualVersine?: number;
  difference?: number;
}

interface CurveElementEditorProps {
  curveElements?: CurveElement[];
  measurementData?: Array<{ position: number; value: number }>;
  chordLength?: number;
  workDirection?: 'up' | 'down';
  onCurveElementsChange?: (elements: CurveElement[]) => void;
  onTrapezoidSubtraction?: (data: TrapezoidVisualization[]) => void;
}

const CurveElementEditor: React.FC<CurveElementEditorProps> = ({
  curveElements: initialElements = [],
  measurementData,
  chordLength = 10,
  workDirection = 'up',
  onCurveElementsChange,
  onTrapezoidSubtraction
}) => {
  const [elements, setElements] = useState<CurveElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<Partial<CurveElement>>({});
  const [showTrapezoid, setShowTrapezoid] = useState(true);
  const [showDifference, setShowDifference] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 正矢計算（mm単位）
  const calculateVersine = useCallback((radius: number, chord: number) => {
    // V = L²/(8R) * 1000 (mm単位)
    return (chord * chord * 1000) / (8 * radius);
  }, []);

  // 緩和曲線のD/6補正計算
  const calculateTransitionCorrection = useCallback((
    position: number,
    startKm: number,
    transitionLength: number,
    radius: number,
    direction: 'left' | 'right'
  ) => {
    const distanceFromStart = position - startKm;

    if (distanceFromStart < 0 || distanceFromStart > transitionLength) {
      return 0;
    }

    // D/6補正: x³/(6RL)
    const correction = (Math.pow(distanceFromStart, 3) * 1000) / (6 * radius * transitionLength);

    return direction === 'right' ? correction : -correction;
  }, []);

  // 理論正矢の計算（台形）
  const calculateTheoreticalTrapezoid = useCallback((
    elements: CurveElement[],
    startPos: number,
    endPos: number,
    interval: number = 0.25
  ): TrapezoidVisualization[] => {
    const result: TrapezoidVisualization[] = [];

    for (let pos = startPos; pos <= endPos; pos += interval) {
      let theoreticalVersine = 0;

      elements.forEach(element => {
        if (pos >= element.startKm && pos <= element.endKm) {
          const baseVersine = calculateVersine(element.radius, chordLength);

          // 符号調整（右カーブが正、左カーブが負）
          let versine = element.direction === 'right' ? baseVersine : -baseVersine;

          // 緩和曲線補正
          if (element.type === 'transition' && element.transitionLength) {
            // 入口緩和曲線
            const entryCorrection = calculateTransitionCorrection(
              pos,
              element.startKm,
              element.transitionLength,
              element.radius,
              element.direction
            );

            // 出口緩和曲線
            const exitCorrection = calculateTransitionCorrection(
              element.endKm - pos,
              0,
              element.transitionLength,
              element.radius,
              element.direction
            );

            versine += entryCorrection + exitCorrection;
          }

          theoreticalVersine += versine;
        }
      });

      // 実測値との差分計算
      const actualPoint = measurementData?.find(p =>
        Math.abs(p.position - pos) < interval / 2
      );

      result.push({
        position: pos,
        theoreticalVersine,
        actualVersine: actualPoint?.value,
        difference: actualPoint ? actualPoint.value - theoreticalVersine : undefined
      });
    }

    return result;
  }, [calculateVersine, calculateTransitionCorrection, chordLength, measurementData]);

  // 新規曲線要素追加
  const addCurveElement = useCallback(() => {
    const errors: Record<string, string> = {};

    // バリデーション
    if (!editingElement.startKm) {
      errors.startKm = '開始キロ程を入力してください';
    }
    if (!editingElement.endKm) {
      errors.endKm = '終了キロ程を入力してください';
    }
    if (editingElement.startKm && editingElement.endKm &&
        editingElement.startKm >= editingElement.endKm) {
      errors.range = '開始キロ程は終了キロ程より小さくしてください';
    }
    if (!editingElement.radius || editingElement.radius <= 0) {
      errors.radius = '有効な半径を入力してください';
    }

    // 重複チェック
    const hasOverlap = elements.some(e =>
      (editingElement.startKm! >= e.startKm && editingElement.startKm! <= e.endKm) ||
      (editingElement.endKm! >= e.startKm && editingElement.endKm! <= e.endKm)
    );

    if (hasOverlap) {
      errors.overlap = '既存の曲線区間と重複しています';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const newElement: CurveElement = {
      id: `curve-${Date.now()}`,
      startKm: editingElement.startKm!,
      endKm: editingElement.endKm!,
      radius: editingElement.radius!,
      direction: editingElement.direction || 'right',
      type: editingElement.type || 'circular',
      transitionLength: editingElement.transitionLength,
      cant: editingElement.cant,
      speed: editingElement.speed,
      notes: editingElement.notes
    };

    const updatedElements = [...elements, newElement].sort((a, b) =>
      workDirection === 'up' ? a.startKm - b.startKm : b.startKm - a.startKm
    );

    setElements(updatedElements);
    setEditingElement({});
    setValidationErrors({});

    if (onCurveElementsChange) {
      onCurveElementsChange(updatedElements);
    }
  }, [editingElement, elements, workDirection, onCurveElementsChange]);

  // 曲線要素の更新
  const updateCurveElement = useCallback((id: string, updates: Partial<CurveElement>) => {
    const updatedElements = elements.map(e =>
      e.id === id ? { ...e, ...updates } : e
    );

    setElements(updatedElements);

    if (onCurveElementsChange) {
      onCurveElementsChange(updatedElements);
    }
  }, [elements, onCurveElementsChange]);

  // 曲線要素の削除
  const deleteCurveElement = useCallback((id: string) => {
    const updatedElements = elements.filter(e => e.id !== id);
    setElements(updatedElements);

    if (onCurveElementsChange) {
      onCurveElementsChange(updatedElements);
    }
  }, [elements, onCurveElementsChange]);

  // CSVインポート
  const importFromCSV = useCallback((csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    const importedElements: CurveElement[] = [];

    // ヘッダー行をスキップ
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());

      if (parts.length >= 4) {
        importedElements.push({
          id: `curve-${Date.now()}-${i}`,
          startKm: parseFloat(parts[0]),
          endKm: parseFloat(parts[1]),
          radius: parseFloat(parts[2]),
          direction: parts[3] as 'left' | 'right',
          type: (parts[4] as 'circular' | 'transition' | 'compound') || 'circular',
          transitionLength: parts[5] ? parseFloat(parts[5]) : undefined,
          cant: parts[6] ? parseFloat(parts[6]) : undefined,
          speed: parts[7] ? parseFloat(parts[7]) : undefined,
          notes: parts[8] || ''
        });
      }
    }

    setElements(importedElements);

    if (onCurveElementsChange) {
      onCurveElementsChange(importedElements);
    }
  }, [onCurveElementsChange]);

  // 台形差引データの生成
  const trapezoidData = useMemo(() => {
    if (!elements.length || !measurementData?.length) {
      return [];
    }

    const minPos = Math.min(...measurementData.map(d => d.position));
    const maxPos = Math.max(...measurementData.map(d => d.position));

    return calculateTheoreticalTrapezoid(elements, minPos, maxPos);
  }, [elements, measurementData, calculateTheoreticalTrapezoid]);

  // チャートデータの生成
  const chartData = useMemo(() => {
    const datasets = [];

    // 理論正矢（台形）
    if (showTrapezoid && trapezoidData.length > 0) {
      datasets.push({
        label: '理論正矢（台形）',
        data: trapezoidData.map(d => ({ x: d.position, y: d.theoreticalVersine })),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        pointRadius: 0
      });
    }

    // 実測値
    if (measurementData && measurementData.length > 0) {
      datasets.push({
        label: '実測通り狂い',
        data: measurementData.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        borderWidth: 1,
        pointRadius: 0
      });
    }

    // 差分（実測－理論）
    if (showDifference && trapezoidData.length > 0) {
      const differenceData = trapezoidData
        .filter(d => d.difference !== undefined)
        .map(d => ({ x: d.position, y: d.difference }));

      datasets.push({
        label: '差分（実測－理論）',
        data: differenceData,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0
      });
    }

    return { datasets };
  }, [trapezoidData, measurementData, showTrapezoid, showDifference]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: '曲線諸元と台形差引'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toFixed(2)}mm @ ${(context.parsed.x / 1000).toFixed(3)}km`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: {
          display: true,
          text: '位置 (m)'
        }
      },
      y: {
        title: {
          display: true,
          text: '正矢 (mm)'
        }
      }
    }
  };

  // 台形差引データを親コンポーネントに通知
  useEffect(() => {
    if (onTrapezoidSubtraction && trapezoidData.length > 0) {
      onTrapezoidSubtraction(trapezoidData);
    }
  }, [trapezoidData, onTrapezoidSubtraction]);

  return (
    <div className="curve-element-editor">
      {/* ヘッダー */}
      <div className="editor-header">
        <h3>曲線諸元管理</h3>
        <div className="header-controls">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showTrapezoid}
              onChange={e => setShowTrapezoid(e.target.checked)}
            />
            台形表示
          </label>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showDifference}
              onChange={e => setShowDifference(e.target.checked)}
            />
            差分表示
          </label>
          <span className="chord-indicator">
            弦長: {chordLength}m
          </span>
        </div>
      </div>

      {/* 入力フォーム */}
      <div className="input-section">
        <h4>新規曲線要素</h4>
        <div className="input-grid">
          <div className="input-group">
            <label>開始キロ程 (m)</label>
            <input
              type="number"
              value={editingElement.startKm || ''}
              onChange={e => setEditingElement({
                ...editingElement,
                startKm: parseFloat(e.target.value)
              })}
              placeholder="例: 540120"
            />
            {validationErrors.startKm && (
              <span className="error">{validationErrors.startKm}</span>
            )}
          </div>

          <div className="input-group">
            <label>終了キロ程 (m)</label>
            <input
              type="number"
              value={editingElement.endKm || ''}
              onChange={e => setEditingElement({
                ...editingElement,
                endKm: parseFloat(e.target.value)
              })}
              placeholder="例: 540320"
            />
            {validationErrors.endKm && (
              <span className="error">{validationErrors.endKm}</span>
            )}
          </div>

          <div className="input-group">
            <label>半径 (m)</label>
            <input
              type="number"
              value={editingElement.radius || ''}
              onChange={e => setEditingElement({
                ...editingElement,
                radius: parseFloat(e.target.value)
              })}
              placeholder="例: 400"
            />
            {validationErrors.radius && (
              <span className="error">{validationErrors.radius}</span>
            )}
          </div>

          <div className="input-group">
            <label>方向</label>
            <select
              value={editingElement.direction || 'right'}
              onChange={e => setEditingElement({
                ...editingElement,
                direction: e.target.value as 'left' | 'right'
              })}
            >
              <option value="right">右カーブ</option>
              <option value="left">左カーブ</option>
            </select>
          </div>

          <div className="input-group">
            <label>曲線種別</label>
            <select
              value={editingElement.type || 'circular'}
              onChange={e => setEditingElement({
                ...editingElement,
                type: e.target.value as 'circular' | 'transition' | 'compound'
              })}
            >
              <option value="circular">単円</option>
              <option value="transition">緩和曲線付</option>
              <option value="compound">複心</option>
            </select>
          </div>

          {editingElement.type === 'transition' && (
            <div className="input-group">
              <label>緩和曲線長 (m)</label>
              <input
                type="number"
                value={editingElement.transitionLength || ''}
                onChange={e => setEditingElement({
                  ...editingElement,
                  transitionLength: parseFloat(e.target.value)
                })}
                placeholder="例: 60"
              />
            </div>
          )}

          <div className="input-group">
            <label>カント (mm)</label>
            <input
              type="number"
              value={editingElement.cant || ''}
              onChange={e => setEditingElement({
                ...editingElement,
                cant: parseFloat(e.target.value)
              })}
              placeholder="例: 105"
            />
          </div>

          <div className="input-group">
            <label>設計速度 (km/h)</label>
            <input
              type="number"
              value={editingElement.speed || ''}
              onChange={e => setEditingElement({
                ...editingElement,
                speed: parseFloat(e.target.value)
              })}
              placeholder="例: 65"
            />
          </div>
        </div>

        {validationErrors.range && (
          <div className="error-message">{validationErrors.range}</div>
        )}
        {validationErrors.overlap && (
          <div className="error-message">{validationErrors.overlap}</div>
        )}

        <button onClick={addCurveElement} className="btn-add">
          曲線要素追加
        </button>
      </div>

      {/* チャート表示 */}
      {(showTrapezoid || measurementData) && (
        <div className="chart-section">
          <div className="chart-container" style={{ height: '400px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* 曲線要素リスト */}
      <div className="elements-list">
        <h4>登録済み曲線要素</h4>
        {elements.length === 0 ? (
          <div className="no-elements">曲線要素が登録されていません</div>
        ) : (
          <div className="element-items">
            {elements.map(element => (
              <div
                key={element.id}
                className={`element-item ${selectedId === element.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(element.id)}
              >
                <div className="element-info">
                  <div className="km-range">
                    {(element.startKm / 1000).toFixed(3)} - {(element.endKm / 1000).toFixed(3)} km
                  </div>
                  <div className="element-details">
                    <span className="radius">R={element.radius}m</span>
                    <span className={`direction ${element.direction}`}>
                      {element.direction === 'right' ? '右' : '左'}
                    </span>
                    <span className="versine">
                      正矢: {calculateVersine(element.radius, chordLength).toFixed(1)}mm
                    </span>
                    {element.type !== 'circular' && (
                      <span className="type">{element.type}</span>
                    )}
                    {element.cant && (
                      <span className="cant">C={element.cant}mm</span>
                    )}
                  </div>
                </div>

                {selectedId === element.id && (
                  <div className="element-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 編集ダイアログを開く（実装省略）
                      }}
                      className="btn-edit"
                    >
                      編集
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCurveElement(element.id);
                      }}
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
    </div>
  );
};

export default CurveElementEditor;