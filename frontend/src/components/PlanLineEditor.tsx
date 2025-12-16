/**
 * 計画線エディタコンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - マーカーによる計画線の手動調整
 * - 直線/復元波形沿い接続モード
 * - 取り付け勾配の表示と警告
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import './PlanLineEditor.css';

interface Marker {
  id: string;
  position: number;  // 位置 (m)
  value: number;     // 値 (mm)
  isFixed?: boolean; // 固定点
}

interface ConnectionSegment {
  startMarkerId: string;
  endMarkerId: string;
  mode: 'linear' | 'waveform';  // 直線 or 復元波形沿い
  gradient?: number;             // 取り付け勾配
  isWarning?: boolean;           // 勾配警告
  isCritical?: boolean;          // 勾配危険
}

interface PlanLineEditorProps {
  restoredWaveform: Array<{ position: number; value: number }>;
  initialPlanLine?: Array<{ position: number; value: number }>;
  movementLimits?: Array<{
    start: number;
    end: number;
    maxUpward: number;
    maxDownward: number;
  }>;
  onPlanLineChange?: (planLine: Array<{ position: number; value: number }>) => void;
  onSaveAndComplete?: (planLine: Array<{ position: number; value: number }>) => void;
  dataInterval?: number;
  isUpwardPriority?: boolean;  // こう上優先モード
  dataType?: 'level' | 'alignment';  // 高低 or 通り
}

const PlanLineEditor: React.FC<PlanLineEditorProps> = ({
  restoredWaveform,
  initialPlanLine,
  movementLimits = [],
  onPlanLineChange,
  onSaveAndComplete,
  dataInterval = 0.25,
  isUpwardPriority = true,
  dataType = 'alignment'
}) => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [connections, setConnections] = useState<ConnectionSegment[]>([]);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [planLine, setPlanLine] = useState(initialPlanLine || []);
  const [showGradients, setShowGradients] = useState(true);
  const [showMovementValues, setShowMovementValues] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 計画線の再計算
  const recalculatePlanLine = useCallback(() => {
    if (markers.length < 2) {
      setPlanLine([]);
      return;
    }

    const sortedMarkers = [...markers].sort((a, b) => a.position - b.position);
    const newPlanLine: Array<{ position: number; value: number }> = [];

    for (let i = 0; i < sortedMarkers.length - 1; i++) {
      const startMarker = sortedMarkers[i];
      const endMarker = sortedMarkers[i + 1];

      const connection = connections.find(
        c => (c.startMarkerId === startMarker.id && c.endMarkerId === endMarker.id) ||
             (c.startMarkerId === endMarker.id && c.endMarkerId === startMarker.id)
      );

      const mode = connection?.mode || 'linear';

      if (mode === 'linear') {
        // 直線接続
        const points = interpolateLinear(startMarker, endMarker, dataInterval);
        newPlanLine.push(...points);
      } else {
        // 復元波形沿い接続
        const points = interpolateAlongWaveform(
          startMarker,
          endMarker,
          restoredWaveform,
          dataInterval
        );
        newPlanLine.push(...points);
      }

      // 取り付け勾配の計算と更新
      const gradient = calculateGradient(startMarker, endMarker);
      updateConnectionGradient(startMarker.id, endMarker.id, gradient);
    }

    setPlanLine(newPlanLine);

    if (onPlanLineChange) {
      onPlanLineChange(newPlanLine);
    }
  }, [markers, connections, restoredWaveform, dataInterval, onPlanLineChange]);

  // マーカー追加
  const addMarker = (position: number, value: number) => {
    const newMarker: Marker = {
      id: `marker-${Date.now()}`,
      position,
      value,
      isFixed: false
    };

    const updatedMarkers = [...markers, newMarker];
    setMarkers(updatedMarkers);

    // 自動的に前後のマーカーと接続
    connectToAdjacentMarkers(newMarker, updatedMarkers);
  };

  // マーカー削除
  const deleteMarker = (markerId: string) => {
    setMarkers(markers.filter(m => m.id !== markerId));
    setConnections(connections.filter(
      c => c.startMarkerId !== markerId && c.endMarkerId !== markerId
    ));
  };

  // マーカーの移動
  const moveMarker = (markerId: string, newPosition: number, newValue: number) => {
    setMarkers(markers.map(m =>
      m.id === markerId ? { ...m, position: newPosition, value: newValue } : m
    ));
  };

  // 接続モードの切り替え
  const toggleConnectionMode = (startMarkerId: string, endMarkerId: string) => {
    setConnections(connections.map(c => {
      if ((c.startMarkerId === startMarkerId && c.endMarkerId === endMarkerId) ||
          (c.startMarkerId === endMarkerId && c.endMarkerId === startMarkerId)) {
        return {
          ...c,
          mode: c.mode === 'linear' ? 'waveform' : 'linear'
        };
      }
      return c;
    }));
  };

  // 隣接マーカーへの自動接続
  const connectToAdjacentMarkers = (newMarker: Marker, allMarkers: Marker[]) => {
    const sorted = [...allMarkers].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex(m => m.id === newMarker.id);

    const newConnections: ConnectionSegment[] = [];

    if (index > 0) {
      const prevMarker = sorted[index - 1];
      newConnections.push({
        startMarkerId: prevMarker.id,
        endMarkerId: newMarker.id,
        mode: 'linear'
      });
    }

    if (index < sorted.length - 1) {
      const nextMarker = sorted[index + 1];
      newConnections.push({
        startMarkerId: newMarker.id,
        endMarkerId: nextMarker.id,
        mode: 'linear'
      });
    }

    setConnections([...connections, ...newConnections]);
  };

  // 直線補間
  const interpolateLinear = (
    start: Marker,
    end: Marker,
    interval: number
  ): Array<{ position: number; value: number }> => {
    const points: Array<{ position: number; value: number }> = [];
    const distance = end.position - start.position;
    const valueDiff = end.value - start.value;

    for (let pos = start.position; pos <= end.position; pos += interval) {
      const ratio = (pos - start.position) / distance;
      points.push({
        position: pos,
        value: start.value + valueDiff * ratio
      });
    }

    return points;
  };

  // 復元波形沿い補間
  const interpolateAlongWaveform = (
    start: Marker,
    end: Marker,
    waveform: Array<{ position: number; value: number }>,
    interval: number
  ): Array<{ position: number; value: number }> => {
    const points: Array<{ position: number; value: number }> = [];

    // 開始・終了位置間の波形データを取得
    const waveSegment = waveform.filter(
      w => w.position >= start.position && w.position <= end.position
    );

    if (waveSegment.length === 0) {
      return interpolateLinear(start, end, interval);
    }

    // 波形の形状を保持しながらオフセット調整
    const startWaveValue = waveSegment[0].value;
    const endWaveValue = waveSegment[waveSegment.length - 1].value;
    const startOffset = start.value - startWaveValue;
    const endOffset = end.value - endWaveValue;

    waveSegment.forEach((w, index) => {
      const ratio = index / (waveSegment.length - 1);
      const offset = startOffset + (endOffset - startOffset) * ratio;

      points.push({
        position: w.position,
        value: w.value + offset
      });
    });

    return points;
  };

  // 取り付け勾配の計算
  const calculateGradient = (start: Marker, end: Marker): number => {
    const distance = Math.abs(end.position - start.position);
    const heightDiff = Math.abs(end.value - start.value);

    if (distance === 0) return Infinity;

    // 勾配を1/N形式で返す
    return distance / heightDiff * 1000;  // mm to m変換
  };

  // 接続の勾配更新
  const updateConnectionGradient = (
    startMarkerId: string,
    endMarkerId: string,
    gradient: number
  ) => {
    setConnections(connections.map(c => {
      if ((c.startMarkerId === startMarkerId && c.endMarkerId === endMarkerId) ||
          (c.startMarkerId === endMarkerId && c.endMarkerId === startMarkerId)) {
        return {
          ...c,
          gradient,
          isWarning: gradient < 2500,      // 1/2500未満で警告
          isCritical: gradient < 400       // 1/400未満で危険
        };
      }
      return c;
    }));
  };

  // 移動量の計算
  const calculateMovementAmount = (position: number): number => {
    const wavePoint = restoredWaveform.find(w => Math.abs(w.position - position) < 0.01);
    const planPoint = planLine.find(p => Math.abs(p.position - position) < 0.01);

    if (wavePoint && planPoint) {
      return planPoint.value - wavePoint.value;
    }

    return 0;
  };

  // こう上量のチェック
  const checkUpwardAmount = (): {
    totalUpward: number;
    totalDownward: number;
    ratio: number;
    warnings: Array<{ position: number; amount: number }>;
  } => {
    let totalUpward = 0;
    let totalDownward = 0;
    const warnings: Array<{ position: number; amount: number }> = [];

    planLine.forEach(point => {
      const movement = calculateMovementAmount(point.position);

      if (movement > 0) {
        totalUpward++;
      } else if (movement < 0) {
        totalDownward++;
        if (movement < -10) {  // 10mm以上の下方向移動
          warnings.push({ position: point.position, amount: movement });
        }
      }
    });

    const total = totalUpward + totalDownward;
    const ratio = total > 0 ? totalUpward / total : 0;

    return {
      totalUpward,
      totalDownward,
      ratio,
      warnings
    };
  };

  // 移動量制限のチェック
  const checkMovementLimits = (position: number, movement: number): boolean => {
    for (const limit of movementLimits) {
      if (position >= limit.start && position <= limit.end) {
        if (movement > 0 && movement > limit.maxUpward) {
          return true;  // 上方向制限超過
        }
        if (movement < 0 && Math.abs(movement) > limit.maxDownward) {
          return true;  // 下方向制限超過
        }
      }
    }
    return false;
  };

  // チャートデータの生成
  const generateChartData = () => {
    const datasets = [];

    // 復元波形
    datasets.push({
      label: '復元波形',
      data: restoredWaveform.map(w => ({ x: w.position, y: w.value })),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    });

    // 計画線
    if (planLine.length > 0) {
      datasets.push({
        label: '計画線',
        data: planLine.map(p => ({ x: p.position, y: p.value })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
      });

      // 下方向移動量のハイライト（黄色）
      const downwardPoints = planLine.filter(p => {
        const movement = calculateMovementAmount(p.position);
        return movement < 0;
      });

      if (downwardPoints.length > 0) {
        datasets.push({
          label: '下方向移動',
          data: downwardPoints.map(p => ({ x: p.position, y: p.value })),
          borderColor: 'rgba(255, 206, 86, 0.8)',
          backgroundColor: 'rgba(255, 206, 86, 0.3)',
          borderWidth: 3,
          pointRadius: 2,
          pointBackgroundColor: 'rgba(255, 206, 86, 0.8)',
          showLine: false
        });
      }
    }

    // マーカー
    if (markers.length > 0) {
      datasets.push({
        label: 'マーカー',
        data: markers.map(m => ({ x: m.position, y: m.value })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgb(54, 162, 235)',
        borderWidth: 0,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false
      });
    }

    // 移動量制限
    movementLimits.forEach((limit, index) => {
      datasets.push({
        label: `移動量制限 ${index + 1}`,
        data: restoredWaveform
          .filter(w => w.position >= limit.start && w.position <= limit.end)
          .map(w => ({ x: w.position, y: w.value + limit.maxUpward })),
        borderColor: 'rgba(255, 206, 86, 0.5)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      });
    });

    return { datasets };
  };

  // データの最小・最大値を計算してY軸のスケールを決定
  const getYAxisScale = () => {
    let minValue = Infinity;
    let maxValue = -Infinity;

    // 復元波形の値範囲を取得
    restoredWaveform.forEach(point => {
      minValue = Math.min(minValue, point.value);
      maxValue = Math.max(maxValue, point.value);
    });

    // 計画線の値範囲も考慮
    if (planLine.length > 0) {
      planLine.forEach(point => {
        minValue = Math.min(minValue, point.value);
        maxValue = Math.max(maxValue, point.value);
      });
    }

    // データタイプに応じた適切なスケールを設定
    // 通りの場合は狭い範囲（±10mm程度）、高低の場合は広い範囲（±30mm程度）
    const dataRange = maxValue - minValue;
    let scaleMin, scaleMax;

    if (dataType === 'alignment') {
      // 通り狂いの場合（通常±5mm、最大でも±10mm程度）
      if (dataRange < 1) {
        // データ範囲が1mm未満の場合は±5mmで表示
        const center = (minValue + maxValue) / 2;
        scaleMin = center - 5;
        scaleMax = center + 5;
      } else if (dataRange < 10) {
        // データ範囲が10mm未満の場合は±10mmで表示
        const center = (minValue + maxValue) / 2;
        scaleMin = center - 10;
        scaleMax = center + 10;
      } else {
        // それ以上の場合は実データ範囲+マージン
        const margin = dataRange * 0.2;
        scaleMin = minValue - margin;
        scaleMax = maxValue + margin;
      }
    } else {
      // 高低狂いの場合（通常±15mm、最大でも±30mm程度）
      if (dataRange < 5) {
        // データ範囲が5mm未満の場合は±15mmで表示
        const center = (minValue + maxValue) / 2;
        scaleMin = center - 15;
        scaleMax = center + 15;
      } else if (dataRange < 30) {
        // データ範囲が30mm未満の場合は±30mmで表示
        const center = (minValue + maxValue) / 2;
        scaleMin = center - 30;
        scaleMax = center + 30;
      } else {
        // それ以上の場合は実データ範囲+マージン
        const margin = dataRange * 0.2;
        scaleMin = minValue - margin;
        scaleMax = maxValue + margin;
      }
    }

    return { min: scaleMin, max: scaleMax };
  };

  const yAxisScale = getYAxisScale();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'point' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: `計画線エディタ - ${dataType === 'alignment' ? '通り狂い' : '高低狂い'}`
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y.toFixed(2);
            const position = context.parsed.x.toFixed(2);

            if (label === '計画線') {
              const movement = calculateMovementAmount(context.parsed.x);
              return `${label}: ${value}mm (移動量: ${movement.toFixed(2)}mm)`;
            }

            return `${label}: ${value}mm @ ${position}m`;
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
          text: `${dataType === 'alignment' ? '通り' : '高低'} (mm)`
        },
        min: yAxisScale.min,
        max: yAxisScale.max,
        ticks: {
          stepSize: dataType === 'alignment' ? 1 : 5  // 通りは1mm刻み、高低は5mm刻み
        }
      }
    },
    onClick: (event: any, elements: any) => {
      if (isAddingMarker) {
        const chart = chartRef.current;
        if (chart) {
          const canvasPosition = chart.canvas.getBoundingClientRect();
          const x = event.native.clientX - canvasPosition.left;
          const y = event.native.clientY - canvasPosition.top;

          const xScale = chart.scales.x;
          const yScale = chart.scales.y;

          const position = xScale.getValueForPixel(x);
          const value = yScale.getValueForPixel(y);

          addMarker(position, value);
          setIsAddingMarker(false);
          setCursorPosition(null);
        }
      } else if (elements && elements.length > 0) {
        // マーカーの右クリック削除準備
        const element = elements[0];
        if (element.datasetIndex === 2) { // マーカーのデータセット
          const markerIndex = element.index;
          if (markerIndex >= 0 && markerIndex < markers.length) {
            setSelectedMarkerId(markers[markerIndex].id);
          }
        }
      }
    },
    onHover: (event: any, activeElements: any) => {
      if (isAddingMarker && chartRef.current) {
        const chart = chartRef.current;
        const canvasPosition = chart.canvas.getBoundingClientRect();
        setCursorPosition({
          x: event.native.clientX - canvasPosition.left,
          y: event.native.clientY - canvasPosition.top
        });
      } else {
        setCursorPosition(null);
      }
    }
  };

  // 右クリックでマーカー削除
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    if (selectedMarkerId) {
      deleteMarker(selectedMarkerId);
      setSelectedMarkerId(null);
    }
  }, [selectedMarkerId]);

  // 計画線の再計算（依存関係の変更時）
  useEffect(() => {
    recalculatePlanLine();
  }, [markers, connections, recalculatePlanLine]);

  // こう上量のチェック（isUpwardPriority有効時）
  useEffect(() => {
    if (isUpwardPriority && planLine.length > 0) {
      const result = checkUpwardAmount();

      if (result.ratio < 0.7) {
        console.warn(`こう上率が不足: ${(result.ratio * 100).toFixed(1)}% (目標70%以上)`);
      }

      if (result.warnings.length > 0) {
        console.warn('下方向移動量が大きい箇所:', result.warnings);
      }
    }
  }, [planLine, isUpwardPriority]);

  // 右クリックイベントリスナー
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
      return () => {
        container.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [handleContextMenu]);

  return (
    <div className="plan-line-editor" ref={containerRef}>
      {/* ツールバー */}
      <div className="editor-toolbar">
        <button
          className="tool-button"
          onClick={() => setShowGradients(!showGradients)}
        >
          📐 勾配表示: {showGradients ? 'ON' : 'OFF'}
        </button>

        <button
          className="tool-button"
          onClick={() => setShowMovementValues(!showMovementValues)}
        >
          📊 移動量表示: {showMovementValues ? 'ON' : 'OFF'}
        </button>

        {isUpwardPriority && (
          <div className="upward-indicator">
            こう上優先モード
          </div>
        )}
      </div>

      {/* チャート */}
      <div className={`chart-container ${isAddingMarker ? 'adding-marker' : ''}`} style={{ height: '500px', position: 'relative' }}>
        {/* マーカー追加ボタン（画面右側） */}
        <button
          className={`marker-button ${isAddingMarker ? 'active' : ''}`}
          onClick={() => setIsAddingMarker(!isAddingMarker)}
          style={{
            position: 'absolute',
            right: '20px',
            top: '20px',
            zIndex: 10
          }}
        >
          {isAddingMarker ? '✖' : 'マーク'}
        </button>

        {/* マーカー追加モード時の＋カーソル表示 */}
        {isAddingMarker && cursorPosition && (
          <div
            className="marker-cursor"
            style={{
              position: 'absolute',
              left: cursorPosition.x - 10,
              top: cursorPosition.y - 10,
              width: '20px',
              height: '20px',
              pointerEvents: 'none',
              zIndex: 100,
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#007bff',
              textAlign: 'center',
              lineHeight: '20px'
            }}
          >
            ＋
          </div>
        )}

        <Line ref={chartRef} data={generateChartData()} options={chartOptions} />

        {/* 移動量ラベルの表示 */}
        {showMovementValues && planLine.length > 0 && (
          <div className="movement-labels">
            {(() => {
              const significantMovements: Array<{
                position: number;
                value: number;
                movement: number;
              }> = [];

              // 10mm間隔で移動量をチェック（通り狂い）
              // 15mm間隔で移動量をチェック（高低狂い）
              const threshold = 10; // 表示閾値 (mm)
              const interval = 10; // チェック間隔 (m)

              for (let i = 0; i < planLine.length; i += Math.round(interval / dataInterval)) {
                const point = planLine[i];
                const movement = calculateMovementAmount(point.position);

                if (Math.abs(movement) >= threshold) {
                  significantMovements.push({
                    position: point.position,
                    value: point.value,
                    movement
                  });
                }
              }

              return significantMovements.map((item, index) => {
                const chart = chartRef.current;
                if (!chart) return null;

                const xScale = chart.scales?.x;
                const yScale = chart.scales?.y;

                if (!xScale || !yScale) return null;

                const x = xScale.getPixelForValue(item.position);
                const y = yScale.getPixelForValue(item.value);

                return (
                  <div
                    key={`label-${index}`}
                    className={`movement-label ${item.movement > 0 ? 'upward' : 'downward'}`}
                    style={{
                      position: 'absolute',
                      left: x - 20,
                      top: y - 25,
                      pointerEvents: 'none',
                      zIndex: 50
                    }}
                  >
                    {item.movement > 0 ? '↑' : '↓'}{Math.abs(item.movement).toFixed(0)}mm
                  </div>
                );
              });
            })()}
          </div>
        )}

      {/* 勾配警告表示 */}
      {showGradients && (
        <div className="gradient-warnings">
          {connections.filter(c => c.isWarning).map(c => {
            const startMarker = markers.find(m => m.id === c.startMarkerId);
            const endMarker = markers.find(m => m.id === c.endMarkerId);

            if (!startMarker || !endMarker) return null;

            return (
              <div
                key={`${c.startMarkerId}-${c.endMarkerId}`}
                className={`gradient-warning ${c.isCritical ? 'critical' : ''}`}
              >
                {c.isCritical ? '⚠️ 危険' : '⚡ 警告'}:
                {startMarker.position.toFixed(1)}m - {endMarker.position.toFixed(1)}m
                勾配 1/{c.gradient?.toFixed(0)}
              </div>
            );
          })}
        </div>
      )}

      {/* 移動量統計 */}
      <div className="movement-statistics">
        <h4>移動量統計</h4>
        {planLine.length > 0 && (
          <>
            <p>計画線点数: {planLine.length}</p>
            <p>マーカー数: {markers.length}</p>
            {isUpwardPriority && (() => {
              const result = checkUpwardAmount();
              return (
                <>
                  <p>こう上率: {(result.ratio * 100).toFixed(1)}%</p>
                  <p className={result.ratio >= 0.7 ? 'good' : 'warning'}>
                    {result.ratio >= 0.7 ? '✅ 目標達成' : '⚠️ 目標未達成'}
                  </p>
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* 保存して次へボタン */}
      {onSaveAndComplete && planLine.length > 0 && (
        <div className="editor-actions" style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            className="save-complete-button"
            onClick={() => onSaveAndComplete(planLine)}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            計画線を保存して次のステップへ
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanLineEditor;// Force HMR update at 2025年 12月 14日 日曜日 22:22:25    
