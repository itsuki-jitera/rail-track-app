/**
 * 位置合わせ・曲線諸元確認コンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P17-19に基づく実装
 * - 手検測データとキヤデータの重ね合わせ表示
 * - 波形の前後移動調整
 * - 相関係数の表示
 * - 10m/20m/40m弦長選択
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import './PositionAlignmentVerification.css';

interface DataPoint {
  position: number;
  value: number;
}

interface CurveElement {
  startKm: number;
  endKm: number;
  radius: number;
  direction: 'left' | 'right';
  versine?: number;
}

interface PositionAlignmentVerificationProps {
  kiyaData: DataPoint[];          // キヤデータ（切取りデータ）
  handMeasurementData?: DataPoint[]; // 手検測データ
  curveElements?: CurveElement[];   // 曲線諸元
  dataType?: 'alignment' | 'level' | 'gauge'; // データタイプ
  workDirection?: 'up' | 'down';
  onAlignmentChange?: (offset: number) => void;
  onCurveElementsUpdate?: (curves: CurveElement[]) => void;
}

const PositionAlignmentVerification: React.FC<PositionAlignmentVerificationProps> = ({
  kiyaData,
  handMeasurementData,
  curveElements = [],
  dataType = 'alignment',
  workDirection = 'up',
  onAlignmentChange,
  onCurveElementsUpdate
}) => {
  const [positionOffset, setPositionOffset] = useState(0);  // 位置オフセット (m)
  const [chordLength, setChordLength] = useState(10);       // 弦長 (10m/20m/40m)
  const [verticalScale, setVerticalScale] = useState(1);    // 縦縮尺 (1/2/4)
  const [correlation, setCorrelation] = useState(0);        // 相関係数
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [selectedCurveIndex, setSelectedCurveIndex] = useState<number | null>(null);
  const [showCurveVersine, setShowCurveVersine] = useState(true);
  const [adjustmentMode, setAdjustmentMode] = useState<'manual' | 'auto'>('manual');

  const chartRef = useRef<any>(null);

  // 相関係数の計算
  const calculateCorrelation = useCallback((offset: number) => {
    if (!handMeasurementData || handMeasurementData.length === 0) {
      return 0;
    }

    const alignedHandData = handMeasurementData.map(p => ({
      ...p,
      position: p.position + offset
    }));

    // 重複範囲を見つける
    const minPos = Math.max(
      Math.min(...kiyaData.map(p => p.position)),
      Math.min(...alignedHandData.map(p => p.position))
    );
    const maxPos = Math.min(
      Math.max(...kiyaData.map(p => p.position)),
      Math.max(...alignedHandData.map(p => p.position))
    );

    // 共通位置でのデータペアを作成
    const pairs: Array<{ kiya: number; hand: number }> = [];

    for (let pos = minPos; pos <= maxPos; pos += 0.25) {
      const kiyaPoint = kiyaData.find(p => Math.abs(p.position - pos) < 0.125);
      const handPoint = alignedHandData.find(p => Math.abs(p.position - pos) < 0.125);

      if (kiyaPoint && handPoint) {
        pairs.push({ kiya: kiyaPoint.value, hand: handPoint.value });
      }
    }

    if (pairs.length < 2) {
      return 0;
    }

    // Pearson相関係数の計算
    const n = pairs.length;
    const sumKiya = pairs.reduce((sum, p) => sum + p.kiya, 0);
    const sumHand = pairs.reduce((sum, p) => sum + p.hand, 0);
    const sumKiyaSquare = pairs.reduce((sum, p) => sum + p.kiya * p.kiya, 0);
    const sumHandSquare = pairs.reduce((sum, p) => sum + p.hand * p.hand, 0);
    const sumProduct = pairs.reduce((sum, p) => sum + p.kiya * p.hand, 0);

    const numerator = n * sumProduct - sumKiya * sumHand;
    const denominator = Math.sqrt(
      (n * sumKiyaSquare - sumKiya * sumKiya) *
      (n * sumHandSquare - sumHand * sumHand)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }, [kiyaData, handMeasurementData]);

  // 自動位置合わせ
  const autoAlign = useCallback(async () => {
    setIsAutoAligning(true);

    // ±20m範囲で最適なオフセットを探索
    const searchRange = 20;
    const searchStep = 0.25;
    let bestOffset = 0;
    let bestCorrelation = -1;

    for (let offset = -searchRange; offset <= searchRange; offset += searchStep) {
      const corr = calculateCorrelation(offset);
      if (Math.abs(corr) > Math.abs(bestCorrelation)) {
        bestCorrelation = corr;
        bestOffset = offset;
      }
    }

    setPositionOffset(bestOffset);
    setCorrelation(bestCorrelation);

    if (onAlignmentChange) {
      onAlignmentChange(bestOffset);
    }

    setIsAutoAligning(false);
  }, [calculateCorrelation, onAlignmentChange]);

  // 手動位置調整
  const adjustPosition = useCallback((direction: 'left' | 'right', amount: number) => {
    const newOffset = direction === 'left'
      ? positionOffset - amount
      : positionOffset + amount;

    setPositionOffset(newOffset);
    const newCorrelation = calculateCorrelation(newOffset);
    setCorrelation(newCorrelation);

    if (onAlignmentChange) {
      onAlignmentChange(newOffset);
    }
  }, [positionOffset, calculateCorrelation, onAlignmentChange]);

  // 曲線正矢の計算
  const calculateCurveVersine = useCallback((curve: CurveElement, chordLen: number) => {
    // 正矢 = L²/(8R) ここで L:弦長(m), R:半径(m)
    return (chordLen * chordLen * 1000) / (8 * curve.radius);
  }, []);

  // 曲線諸元の修正
  const updateCurveElement = useCallback((index: number, updates: Partial<CurveElement>) => {
    const updatedCurves = curveElements.map((curve, i) =>
      i === index ? { ...curve, ...updates } : curve
    );

    if (onCurveElementsUpdate) {
      onCurveElementsUpdate(updatedCurves);
    }
  }, [curveElements, onCurveElementsUpdate]);

  // チャートデータの生成
  const generateChartData = () => {
    const datasets = [];

    // キヤデータ
    datasets.push({
      label: `キヤデータ (${dataType === 'alignment' ? '通り' : dataType === 'level' ? '高低' : '軌間'})`,
      data: kiyaData.map(p => ({ x: p.position, y: p.value * verticalScale })),
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    });

    // 手検測データ（オフセット適用）
    if (handMeasurementData && handMeasurementData.length > 0) {
      datasets.push({
        label: '手検測データ',
        data: handMeasurementData.map(p => ({
          x: p.position + positionOffset,
          y: p.value * verticalScale
        })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 3,
        pointBackgroundColor: 'rgb(255, 99, 132)',
        tension: 0
      });
    }

    // 曲線正矢
    if (showCurveVersine && curveElements.length > 0 && dataType === 'alignment') {
      curveElements.forEach((curve, index) => {
        const versine = calculateCurveVersine(curve, chordLength);
        const curveData = [];

        for (let pos = curve.startKm; pos <= curve.endKm; pos += 0.25) {
          curveData.push({
            x: pos,
            y: (curve.direction === 'right' ? versine : -versine) * verticalScale
          });
        }

        datasets.push({
          label: `曲線 R=${curve.radius}m`,
          data: curveData,
          borderColor: index === selectedCurveIndex
            ? 'rgb(255, 206, 86)'
            : 'rgba(75, 192, 192, 0.6)',
          backgroundColor: 'transparent',
          borderWidth: index === selectedCurveIndex ? 3 : 1,
          pointRadius: 0,
          tension: 0
        });
      });
    }

    return { datasets };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: '位置合わせ・曲線諸元確認'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y / verticalScale;
            const position = context.parsed.x;
            return `${label}: ${value.toFixed(2)}mm @ ${(position/1000).toFixed(3)}km`;
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
          text: `値 (mm) × ${verticalScale}`
        }
      }
    }
  };

  // 初期相関係数の計算
  useEffect(() => {
    setCorrelation(calculateCorrelation(positionOffset));
  }, [positionOffset, calculateCorrelation]);

  return (
    <div className="position-alignment-verification">
      {/* コントロールパネル */}
      <div className="control-panel">
        <div className="control-section">
          <h4>位置調整</h4>
          <div className="position-controls">
            <button onClick={() => adjustPosition('left', 10)} disabled={isAutoAligning}>
              ← 10m
            </button>
            <button onClick={() => adjustPosition('left', 1)} disabled={isAutoAligning}>
              ← 1m
            </button>
            <button onClick={() => adjustPosition('left', 0.25)} disabled={isAutoAligning}>
              ← 0.25m
            </button>

            <div className="offset-display">
              <span className="label">オフセット:</span>
              <span className="value">{positionOffset.toFixed(2)}m</span>
            </div>

            <button onClick={() => adjustPosition('right', 0.25)} disabled={isAutoAligning}>
              0.25m →
            </button>
            <button onClick={() => adjustPosition('right', 1)} disabled={isAutoAligning}>
              1m →
            </button>
            <button onClick={() => adjustPosition('right', 10)} disabled={isAutoAligning}>
              10m →
            </button>
          </div>

          <button
            onClick={autoAlign}
            disabled={isAutoAligning || !handMeasurementData}
            className="auto-align-btn"
          >
            {isAutoAligning ? '自動調整中...' : '自動位置合わせ'}
          </button>
        </div>

        <div className="control-section">
          <h4>表示設定</h4>

          <div className="control-group">
            <label>弦長:</label>
            <select value={chordLength} onChange={e => setChordLength(Number(e.target.value))}>
              <option value={10}>10m</option>
              <option value={20}>20m</option>
              <option value={40}>40m</option>
            </select>
          </div>

          <div className="control-group">
            <label>縦縮尺:</label>
            <select value={verticalScale} onChange={e => setVerticalScale(Number(e.target.value))}>
              <option value={1}>1mm/1mm</option>
              <option value={2}>2mm/1mm</option>
              <option value={4}>4mm/1mm</option>
            </select>
          </div>

          <div className="control-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={showCurveVersine}
                onChange={e => setShowCurveVersine(e.target.checked)}
              />
              曲線正矢表示
            </label>
          </div>
        </div>

        <div className="control-section">
          <h4>相関情報</h4>
          <div className={`correlation-display ${Math.abs(correlation) > 0.8 ? 'high' : Math.abs(correlation) > 0.6 ? 'medium' : 'low'}`}>
            <span className="label">相関係数:</span>
            <span className="value">{correlation.toFixed(4)}</span>
            <span className="indicator">
              {Math.abs(correlation) > 0.8 ? '良好' : Math.abs(correlation) > 0.6 ? '普通' : '要調整'}
            </span>
          </div>

          {handMeasurementData && (
            <div className="measurement-info">
              <div>手検測開始: {(handMeasurementData[0]?.position / 1000).toFixed(3)}km</div>
              <div>チャート上: {((handMeasurementData[0]?.position + positionOffset) / 1000).toFixed(3)}km</div>
            </div>
          )}
        </div>
      </div>

      {/* チャート表示 */}
      <div className="chart-container" style={{ height: '500px' }}>
        <Line ref={chartRef} data={generateChartData()} options={chartOptions} />
      </div>

      {/* 曲線諸元編集 */}
      {curveElements.length > 0 && (
        <div className="curve-elements-editor">
          <h4>曲線諸元</h4>
          <div className="curve-list">
            {curveElements.map((curve, index) => (
              <div
                key={index}
                className={`curve-item ${selectedCurveIndex === index ? 'selected' : ''}`}
                onClick={() => setSelectedCurveIndex(index)}
              >
                <div className="curve-info">
                  <span className="range">
                    {(curve.startKm / 1000).toFixed(3)} - {(curve.endKm / 1000).toFixed(3)}km
                  </span>
                  <span className="radius">R={curve.radius}m</span>
                  <span className="direction">{curve.direction === 'right' ? '右' : '左'}</span>
                  <span className="versine">
                    正矢: {calculateCurveVersine(curve, chordLength).toFixed(1)}mm
                  </span>
                </div>

                {selectedCurveIndex === index && (
                  <div className="curve-edit">
                    <input
                      type="number"
                      value={curve.radius}
                      onChange={e => updateCurveElement(index, {
                        radius: parseFloat(e.target.value)
                      })}
                      placeholder="半径 (m)"
                    />
                    <select
                      value={curve.direction}
                      onChange={e => updateCurveElement(index, {
                        direction: e.target.value as 'left' | 'right'
                      })}
                    >
                      <option value="right">右カーブ</option>
                      <option value="left">左カーブ</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionAlignmentVerification;