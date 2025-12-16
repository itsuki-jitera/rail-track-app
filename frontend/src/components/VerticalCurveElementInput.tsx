/**
 * 縦曲線諸元入力コンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P20-21に基づく実装
 * - 10m弦縦曲線の入力・管理
 * - 縦曲線の除去処理
 * - 上り/下り勾配の管理
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import './VerticalCurveElementInput.css';

interface VerticalCurveElement {
  id: string;
  startKm: number;        // 開始キロ程 (m)
  endKm: number;          // 終了キロ程 (m)
  startGradient: number;  // 開始勾配 (‰)
  endGradient: number;    // 終了勾配 (‰)
  radius: number;         // 縦曲線半径 (m)
  type: 'convex' | 'concave';  // 凸型/凹型
  notes?: string;
}

interface GradientSection {
  startKm: number;
  endKm: number;
  gradient: number;  // 勾配 (‰)
}

interface VerticalCurveVisualization {
  position: number;
  theoreticalLevel: number;
  actualLevel?: number;
  difference?: number;
}

interface VerticalCurveElementInputProps {
  verticalCurves?: VerticalCurveElement[];
  gradientSections?: GradientSection[];
  measurementData?: Array<{ position: number; value: number }>;
  chordLength?: number;
  workDirection?: 'up' | 'down';
  onVerticalCurvesChange?: (curves: VerticalCurveElement[]) => void;
  onGradientSectionsChange?: (sections: GradientSection[]) => void;
  onVerticalCurveRemoval?: (processedData: Array<{ position: number; value: number }>) => void;
}

const VerticalCurveElementInput: React.FC<VerticalCurveElementInputProps> = ({
  verticalCurves: initialCurves = [],
  gradientSections: initialSections = [],
  measurementData,
  chordLength = 10,
  workDirection = 'up',
  onVerticalCurvesChange,
  onGradientSectionsChange,
  onVerticalCurveRemoval
}) => {
  const [verticalCurves, setVerticalCurves] = useState<VerticalCurveElement[]>(initialCurves);
  const [gradientSections, setGradientSections] = useState<GradientSection[]>(initialSections);
  const [editingCurve, setEditingCurve] = useState<Partial<VerticalCurveElement>>({});
  const [editingGradient, setEditingGradient] = useState<Partial<GradientSection>>({});
  const [selectedCurveId, setSelectedCurveId] = useState<string | null>(null);
  const [showTheoretical, setShowTheoretical] = useState(true);
  const [showProcessed, setShowProcessed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 10m弦縦曲線の理論値計算
  const calculate10mChordVerticalCurve = useCallback((
    position: number,
    curve: VerticalCurveElement
  ): number => {
    // 縦曲線内の位置チェック
    if (position < curve.startKm || position > curve.endKm) {
      return 0;
    }

    const relativePos = position - curve.startKm;
    const curveLength = curve.endKm - curve.startKm;

    // 縦曲線の正矢計算: y = x²/(2R)
    // 10m弦の場合の補正を適用
    const versine = (relativePos * (curveLength - relativePos)) / (2 * curve.radius);

    // 10m弦換算（mm単位）
    const chordCorrection = (chordLength * chordLength) / (8 * curve.radius) * 1000;

    // 凸型は正、凹型は負
    const sign = curve.type === 'convex' ? 1 : -1;

    return sign * versine * chordCorrection / curveLength;
  }, [chordLength]);

  // 勾配による高低計算
  const calculateGradientLevel = useCallback((
    position: number,
    sections: GradientSection[]
  ): number => {
    let cumulativeLevel = 0;
    let currentPosition = sections[0]?.startKm || 0;

    for (const section of sections) {
      if (position < section.startKm) {
        break;
      }

      const endPos = Math.min(position, section.endKm);
      const distance = endPos - currentPosition;

      // 勾配による高低変化（‰を実際の比率に変換）
      cumulativeLevel += distance * (section.gradient / 1000);

      currentPosition = endPos;
    }

    return cumulativeLevel * 1000; // mm単位に変換
  }, []);

  // 縦曲線除去処理
  const removeVerticalCurves = useCallback((
    data: Array<{ position: number; value: number }>,
    curves: VerticalCurveElement[]
  ): Array<{ position: number; value: number }> => {
    return data.map(point => {
      let curveEffect = 0;

      // 全ての縦曲線の影響を計算
      curves.forEach(curve => {
        curveEffect += calculate10mChordVerticalCurve(point.position, curve);
      });

      return {
        position: point.position,
        value: point.value - curveEffect
      };
    });
  }, [calculate10mChordVerticalCurve]);

  // 新規縦曲線追加
  const addVerticalCurve = useCallback(() => {
    const errors: Record<string, string> = {};

    // バリデーション
    if (!editingCurve.startKm) {
      errors.startKm = '開始キロ程を入力してください';
    }
    if (!editingCurve.endKm) {
      errors.endKm = '終了キロ程を入力してください';
    }
    if (!editingCurve.radius || editingCurve.radius <= 0) {
      errors.radius = '有効な半径を入力してください';
    }

    if (editingCurve.startKm && editingCurve.endKm &&
        editingCurve.startKm >= editingCurve.endKm) {
      errors.range = '開始キロ程は終了キロ程より小さくしてください';
    }

    // 最小縦曲線長チェック（通常100m以上）
    if (editingCurve.startKm && editingCurve.endKm) {
      const curveLength = editingCurve.endKm - editingCurve.startKm;
      if (curveLength < 100) {
        errors.minLength = '縦曲線長は100m以上必要です';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const newCurve: VerticalCurveElement = {
      id: `vcurve-${Date.now()}`,
      startKm: editingCurve.startKm!,
      endKm: editingCurve.endKm!,
      startGradient: editingCurve.startGradient || 0,
      endGradient: editingCurve.endGradient || 0,
      radius: editingCurve.radius!,
      type: editingCurve.type || 'convex',
      notes: editingCurve.notes
    };

    const updatedCurves = [...verticalCurves, newCurve].sort((a, b) =>
      workDirection === 'up' ? a.startKm - b.startKm : b.startKm - a.startKm
    );

    setVerticalCurves(updatedCurves);
    setEditingCurve({});
    setValidationErrors({});

    if (onVerticalCurvesChange) {
      onVerticalCurvesChange(updatedCurves);
    }
  }, [editingCurve, verticalCurves, workDirection, onVerticalCurvesChange]);

  // 勾配区間追加
  const addGradientSection = useCallback(() => {
    if (!editingGradient.startKm || !editingGradient.endKm ||
        editingGradient.gradient === undefined) {
      return;
    }

    const newSection: GradientSection = {
      startKm: editingGradient.startKm,
      endKm: editingGradient.endKm,
      gradient: editingGradient.gradient
    };

    const updatedSections = [...gradientSections, newSection].sort((a, b) =>
      a.startKm - b.startKm
    );

    setGradientSections(updatedSections);
    setEditingGradient({});

    if (onGradientSectionsChange) {
      onGradientSectionsChange(updatedSections);
    }
  }, [editingGradient, gradientSections, onGradientSectionsChange]);

  // 縦曲線削除
  const deleteVerticalCurve = useCallback((id: string) => {
    const updatedCurves = verticalCurves.filter(c => c.id !== id);
    setVerticalCurves(updatedCurves);

    if (onVerticalCurvesChange) {
      onVerticalCurvesChange(updatedCurves);
    }
  }, [verticalCurves, onVerticalCurvesChange]);

  // チャート用データ生成
  const chartData = useMemo(() => {
    const datasets = [];

    // 実測データ
    if (measurementData && measurementData.length > 0) {
      datasets.push({
        label: '実測高低',
        data: measurementData.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        borderWidth: 1,
        pointRadius: 0
      });
    }

    // 理論縦曲線
    if (showTheoretical && verticalCurves.length > 0 && measurementData) {
      const theoreticalData = measurementData.map(point => {
        let totalEffect = 0;
        verticalCurves.forEach(curve => {
          totalEffect += calculate10mChordVerticalCurve(point.position, curve);
        });

        // 勾配の影響も加算
        if (gradientSections.length > 0) {
          totalEffect += calculateGradientLevel(point.position, gradientSections);
        }

        return { x: point.position, y: totalEffect };
      });

      datasets.push({
        label: '理論縦曲線',
        data: theoreticalData,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0
      });
    }

    // 縦曲線除去後データ
    if (showProcessed && measurementData && verticalCurves.length > 0) {
      const processedData = removeVerticalCurves(measurementData, verticalCurves);

      datasets.push({
        label: '縦曲線除去後',
        data: processedData.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        pointRadius: 0
      });
    }

    return { datasets };
  }, [
    measurementData,
    verticalCurves,
    gradientSections,
    showTheoretical,
    showProcessed,
    calculate10mChordVerticalCurve,
    calculateGradientLevel,
    removeVerticalCurves
  ]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: '縦曲線諸元と10m弦処理'
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
          text: '高低 (mm)'
        }
      }
    }
  };

  // 縦曲線除去データを親コンポーネントに通知
  useEffect(() => {
    if (onVerticalCurveRemoval && measurementData && verticalCurves.length > 0) {
      const processedData = removeVerticalCurves(measurementData, verticalCurves);
      onVerticalCurveRemoval(processedData);
    }
  }, [measurementData, verticalCurves, removeVerticalCurves, onVerticalCurveRemoval]);

  return (
    <div className="vertical-curve-element-input">
      {/* ヘッダー */}
      <div className="input-header">
        <h3>縦曲線諸元管理</h3>
        <div className="header-info">
          <span className="chord-info">10m弦縦曲線</span>
          <label className="show-toggle">
            <input
              type="checkbox"
              checked={showTheoretical}
              onChange={e => setShowTheoretical(e.target.checked)}
            />
            理論表示
          </label>
          <label className="show-toggle">
            <input
              type="checkbox"
              checked={showProcessed}
              onChange={e => setShowProcessed(e.target.checked)}
            />
            除去後表示
          </label>
        </div>
      </div>

      {/* 縦曲線入力フォーム */}
      <div className="curve-input-form">
        <h4>縦曲線入力</h4>
        <div className="form-row">
          <div className="form-field">
            <label>開始キロ程 (m)</label>
            <input
              type="number"
              value={editingCurve.startKm || ''}
              onChange={e => setEditingCurve({
                ...editingCurve,
                startKm: parseFloat(e.target.value)
              })}
              placeholder="540000"
            />
            {validationErrors.startKm && (
              <span className="field-error">{validationErrors.startKm}</span>
            )}
          </div>

          <div className="form-field">
            <label>終了キロ程 (m)</label>
            <input
              type="number"
              value={editingCurve.endKm || ''}
              onChange={e => setEditingCurve({
                ...editingCurve,
                endKm: parseFloat(e.target.value)
              })}
              placeholder="540200"
            />
            {validationErrors.endKm && (
              <span className="field-error">{validationErrors.endKm}</span>
            )}
          </div>

          <div className="form-field">
            <label>半径 (m)</label>
            <input
              type="number"
              value={editingCurve.radius || ''}
              onChange={e => setEditingCurve({
                ...editingCurve,
                radius: parseFloat(e.target.value)
              })}
              placeholder="5000"
            />
            {validationErrors.radius && (
              <span className="field-error">{validationErrors.radius}</span>
            )}
          </div>

          <div className="form-field">
            <label>種別</label>
            <select
              value={editingCurve.type || 'convex'}
              onChange={e => setEditingCurve({
                ...editingCurve,
                type: e.target.value as 'convex' | 'concave'
              })}
            >
              <option value="convex">凸型</option>
              <option value="concave">凹型</option>
            </select>
          </div>

          <div className="form-field">
            <label>開始勾配 (‰)</label>
            <input
              type="number"
              step="0.1"
              value={editingCurve.startGradient || ''}
              onChange={e => setEditingCurve({
                ...editingCurve,
                startGradient: parseFloat(e.target.value)
              })}
              placeholder="15.0"
            />
          </div>

          <div className="form-field">
            <label>終了勾配 (‰)</label>
            <input
              type="number"
              step="0.1"
              value={editingCurve.endGradient || ''}
              onChange={e => setEditingCurve({
                ...editingCurve,
                endGradient: parseFloat(e.target.value)
              })}
              placeholder="-10.0"
            />
          </div>
        </div>

        {validationErrors.range && (
          <div className="form-error">{validationErrors.range}</div>
        )}
        {validationErrors.minLength && (
          <div className="form-error">{validationErrors.minLength}</div>
        )}

        <button onClick={addVerticalCurve} className="btn-add-curve">
          縦曲線追加
        </button>
      </div>

      {/* 勾配区間入力フォーム */}
      <div className="gradient-input-form">
        <h4>勾配区間入力</h4>
        <div className="form-row">
          <div className="form-field">
            <label>開始キロ程 (m)</label>
            <input
              type="number"
              value={editingGradient.startKm || ''}
              onChange={e => setEditingGradient({
                ...editingGradient,
                startKm: parseFloat(e.target.value)
              })}
            />
          </div>

          <div className="form-field">
            <label>終了キロ程 (m)</label>
            <input
              type="number"
              value={editingGradient.endKm || ''}
              onChange={e => setEditingGradient({
                ...editingGradient,
                endKm: parseFloat(e.target.value)
              })}
            />
          </div>

          <div className="form-field">
            <label>勾配 (‰)</label>
            <input
              type="number"
              step="0.1"
              value={editingGradient.gradient || ''}
              onChange={e => setEditingGradient({
                ...editingGradient,
                gradient: parseFloat(e.target.value)
              })}
              placeholder="15.0"
            />
          </div>
        </div>

        <button onClick={addGradientSection} className="btn-add-gradient">
          勾配区間追加
        </button>
      </div>

      {/* チャート表示 */}
      {measurementData && measurementData.length > 0 && (
        <div className="chart-container" style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {/* 登録済み縦曲線リスト */}
      <div className="curves-list">
        <h4>登録済み縦曲線</h4>
        {verticalCurves.length === 0 ? (
          <div className="no-curves">縦曲線が登録されていません</div>
        ) : (
          <div className="curve-items">
            {verticalCurves.map(curve => (
              <div
                key={curve.id}
                className={`curve-item ${selectedCurveId === curve.id ? 'selected' : ''} ${curve.type}`}
                onClick={() => setSelectedCurveId(curve.id)}
              >
                <div className="curve-info">
                  <span className="curve-range">
                    {(curve.startKm / 1000).toFixed(3)} - {(curve.endKm / 1000).toFixed(3)} km
                  </span>
                  <span className="curve-radius">R={curve.radius}m</span>
                  <span className={`curve-type ${curve.type}`}>
                    {curve.type === 'convex' ? '凸型' : '凹型'}
                  </span>
                  <span className="curve-gradients">
                    {curve.startGradient}‰ → {curve.endGradient}‰
                  </span>
                </div>
                {selectedCurveId === curve.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteVerticalCurve(curve.id);
                    }}
                    className="btn-delete-curve"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 勾配区間リスト */}
      {gradientSections.length > 0 && (
        <div className="gradient-list">
          <h4>勾配区間</h4>
          <div className="gradient-items">
            {gradientSections.map((section, index) => (
              <div key={index} className="gradient-item">
                <span className="gradient-range">
                  {(section.startKm / 1000).toFixed(3)} - {(section.endKm / 1000).toFixed(3)} km
                </span>
                <span className={`gradient-value ${section.gradient > 0 ? 'upward' : 'downward'}`}>
                  {section.gradient > 0 ? '上り' : '下り'} {Math.abs(section.gradient)}‰
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerticalCurveElementInput;