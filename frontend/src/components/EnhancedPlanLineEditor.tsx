/**
 * 強化版計画線エディター
 *
 * グラフスケールの自動調整と適切なデータ保存機能
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, ChartConfiguration } from 'chart.js';
import { useWorkflow } from './WorkflowManager';
import './EnhancedPlanLineEditor.css';

interface PlanLinePoint {
  position: number;
  value: number;
}

interface PlanLineStatistics {
  totalPoints: number;
  upwardPoints: number;
  downwardPoints: number;
  upwardRatio: number;
  maxUpward: number;
  maxDownward: number;
  avgUpward: number;
  avgDownward: number;
  maxValue: number;
  minValue: number;
  range: number;
}

interface EnhancedPlanLineEditorProps {
  restoredWaveform?: PlanLinePoint[];
  initialPlanLine?: PlanLinePoint[];
  dataType?: 'level' | 'alignment'; // 高低 or 通り
  onComplete?: (planLine: PlanLinePoint[], stats: PlanLineStatistics) => void;
}

const EnhancedPlanLineEditor: React.FC<EnhancedPlanLineEditorProps> = ({
  restoredWaveform: propRestoredWaveform,
  initialPlanLine: propInitialPlanLine,
  dataType = 'alignment',
  onComplete
}) => {
  const workflow = useWorkflow ? useWorkflow() : null;
  const chartRef = useRef<Chart | null>(null);

  const restoredWaveform = propRestoredWaveform || workflow?.restoredWaveform || [];
  const [planLine, setPlanLine] = useState<PlanLinePoint[]>([]);
  const [statistics, setStatistics] = useState<PlanLineStatistics | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'edit'>('view');
  const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);

  // データタイプ別の適切なスケール範囲
  const getScaleRange = useCallback(() => {
    if (dataType === 'alignment') {
      // 通りの場合: ±20mm程度を標準表示
      return { min: -20, max: 20, gridStep: 5 };
    } else {
      // 高低の場合: ±50mm程度を標準表示
      return { min: -50, max: 50, gridStep: 10 };
    }
  }, [dataType]);

  // サンプルデータ生成（テスト用）
  useEffect(() => {
    if (restoredWaveform.length === 0) {
      // テスト用の現実的なデータを生成
      const testData: PlanLinePoint[] = [];
      for (let i = 0; i < 400; i++) {
        const position = i * 0.25;
        // 通りの場合: ±5mm程度の変動
        // 高低の場合: ±20mm程度の変動
        const amplitude = dataType === 'alignment' ? 5 : 20;
        const value =
          Math.sin(i * 0.05) * amplitude * 0.3 +  // 長波長成分
          Math.sin(i * 0.15) * amplitude * 0.2 +  // 中波長成分
          (Math.random() - 0.5) * amplitude * 0.1; // ノイズ

        testData.push({ position, value });
      }
      // @ts-ignore - テスト用
      workflow?.updateStepData('restoration', testData);
    }
  }, [restoredWaveform.length, dataType, workflow]);

  // 統計情報の計算（強化版）
  const calculateStatistics = useCallback((
    planLine: PlanLinePoint[],
    restoredWaveform: PlanLinePoint[]
  ): PlanLineStatistics => {
    const stats: PlanLineStatistics = {
      totalPoints: planLine.length,
      upwardPoints: 0,
      downwardPoints: 0,
      upwardRatio: 0,
      maxUpward: 0,
      maxDownward: 0,
      avgUpward: 0,
      avgDownward: 0,
      maxValue: -Infinity,
      minValue: Infinity,
      range: 0
    };

    let totalUpward = 0;
    let totalDownward = 0;

    for (let i = 0; i < planLine.length && i < restoredWaveform.length; i++) {
      const planValue = planLine[i].value;
      const restoredValue = restoredWaveform[i].value;
      const movement = planValue - restoredValue;

      // 絶対値の最大/最小を記録
      stats.maxValue = Math.max(stats.maxValue, planValue, restoredValue);
      stats.minValue = Math.min(stats.minValue, planValue, restoredValue);

      if (movement > 0.1) {
        stats.upwardPoints++;
        totalUpward += movement;
        stats.maxUpward = Math.max(stats.maxUpward, movement);
      } else if (movement < -0.1) {
        stats.downwardPoints++;
        totalDownward += Math.abs(movement);
        stats.maxDownward = Math.max(stats.maxDownward, Math.abs(movement));
      }
    }

    stats.range = stats.maxValue - stats.minValue;
    stats.upwardRatio = stats.totalPoints > 0 ? stats.upwardPoints / stats.totalPoints : 0;
    stats.avgUpward = stats.upwardPoints > 0 ? totalUpward / stats.upwardPoints : 0;
    stats.avgDownward = stats.downwardPoints > 0 ? totalDownward / stats.downwardPoints : 0;

    return stats;
  }, []);

  // 初期計画線の生成（現実的な値）
  const generateRealisticPlanLine = useCallback(() => {
    if (restoredWaveform.length === 0) return;

    // 復元波形を軽く平滑化
    const smoothedLine: PlanLinePoint[] = [];
    const windowSize = 5;

    for (let i = 0; i < restoredWaveform.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -windowSize; j <= windowSize; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < restoredWaveform.length) {
          sum += restoredWaveform[idx].value;
          count++;
        }
      }

      // わずかなこう上バイアス（2-3mm程度）
      const upwardBias = dataType === 'alignment' ? 2 : 5;

      smoothedLine.push({
        position: restoredWaveform[i].position,
        value: (sum / count) + upwardBias
      });
    }

    setPlanLine(smoothedLine);
    const stats = calculateStatistics(smoothedLine, restoredWaveform);
    setStatistics(stats);
  }, [restoredWaveform, dataType, calculateStatistics]);

  // グラフデータの準備（スケール調整済み）
  const chartData = useMemo(() => {
    if (restoredWaveform.length === 0 || planLine.length === 0) return null;

    // 表示範囲の計算
    const startIdx = Math.max(0, Math.floor(panOffset));
    const endIdx = Math.min(
      restoredWaveform.length,
      startIdx + Math.floor(restoredWaveform.length / zoomLevel)
    );

    const displayData = restoredWaveform.slice(startIdx, endIdx);
    const displayPlanLine = planLine.slice(startIdx, endIdx);

    return {
      labels: displayData.map(p => p.position.toFixed(1)),
      datasets: [
        {
          label: '復元波形',
          data: displayData.map(p => p.value),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: '計画線',
          data: displayPlanLine.map(p => p.value),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 2,
          pointRadius: editMode === 'edit' ? 2 : 0,
          pointHoverRadius: 4,
          tension: 0.2
        },
        {
          label: '移動量',
          data: displayPlanLine.map((p, i) =>
            i < displayData.length ? p.value - displayData[i].value : 0
          ),
          borderColor: 'rgb(255, 206, 86)',
          backgroundColor: 'rgba(255, 206, 86, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 5],
          tension: 0.2
        }
      ]
    };
  }, [restoredWaveform, planLine, editMode, zoomLevel, panOffset]);

  // グラフオプション（適切なスケール設定）
  const chartOptions = useMemo((): ChartConfiguration<'line'>['options'] => {
    const scaleRange = getScaleRange();

    // 実データの範囲を考慮
    let yMin = scaleRange.min;
    let yMax = scaleRange.max;

    if (statistics) {
      // データ範囲に応じて自動調整
      const padding = statistics.range * 0.1;
      yMin = Math.min(scaleRange.min, statistics.minValue - padding);
      yMax = Math.max(scaleRange.max, statistics.maxValue + padding);

      // 極端に大きい値がある場合は警告色にする
      if (Math.abs(statistics.maxValue) > 30 || Math.abs(statistics.minValue) > 30) {
        // 警告表示を追加
      }
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: `${dataType === 'alignment' ? '通り' : '高低'}狂い - 復元波形と計画線`,
          font: { size: 16 }
        },
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: ${value.toFixed(2)}mm`;
            }
          }
        },
        annotation: {
          annotations: {
            // 許容範囲の表示
            upperLimit: {
              type: 'line',
              yMin: dataType === 'alignment' ? 10 : 30,
              yMax: dataType === 'alignment' ? 10 : 30,
              borderColor: 'rgba(255, 99, 132, 0.5)',
              borderWidth: 1,
              borderDash: [5, 5],
              label: {
                content: '上限',
                enabled: true,
                position: 'end'
              }
            },
            lowerLimit: {
              type: 'line',
              yMin: dataType === 'alignment' ? -10 : -30,
              yMax: dataType === 'alignment' ? -10 : -30,
              borderColor: 'rgba(255, 99, 132, 0.5)',
              borderWidth: 1,
              borderDash: [5, 5],
              label: {
                content: '下限',
                enabled: true,
                position: 'end'
              }
            },
            zeroLine: {
              type: 'line',
              yMin: 0,
              yMax: 0,
              borderColor: 'rgba(0, 0, 0, 0.3)',
              borderWidth: 1
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: '位置 (m)'
          }
        },
        y: {
          display: true,
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: '変位 (mm)'
          },
          ticks: {
            stepSize: scaleRange.gridStep,
            callback: (value) => `${value}mm`
          },
          grid: {
            color: (context) => {
              if (context.tick.value === 0) {
                return 'rgba(0, 0, 0, 0.3)';
              }
              return 'rgba(0, 0, 0, 0.1)';
            }
          }
        }
      }
    };
  }, [statistics, dataType, getScaleRange]);

  // 初期化
  useEffect(() => {
    if (propInitialPlanLine) {
      setPlanLine(propInitialPlanLine);
    } else if (restoredWaveform.length > 0 && planLine.length === 0) {
      generateRealisticPlanLine();
    }
  }, [restoredWaveform, propInitialPlanLine, planLine.length, generateRealisticPlanLine]);

  // データ保存と次のステップへの遷移
  const savePlanLineData = useCallback(() => {
    if (planLine.length === 0 || !statistics) {
      alert('計画線データがありません');
      return;
    }

    // 妥当性チェック
    const warnings = [];
    if (statistics.upwardRatio < 0.5) {
      warnings.push('こう上率が50%未満です');
    }
    if (statistics.maxUpward > 50) {
      warnings.push(`最大こう上量が大きすぎます: ${statistics.maxUpward.toFixed(1)}mm`);
    }
    if (statistics.maxDownward > 20) {
      warnings.push(`最大こう下量が大きすぎます: ${statistics.maxDownward.toFixed(1)}mm`);
    }

    if (warnings.length > 0 && !window.confirm(
      `以下の警告があります:\n${warnings.join('\n')}\n\n続行しますか？`
    )) {
      return;
    }

    // ワークフローに保存
    if (workflow) {
      workflow.updateStepData('plan-line', {
        planLine,
        statistics,
        dataType,
        timestamp: new Date().toISOString()
      });
      workflow.markStepCompleted('plan-line');
    }

    // コールバック実行
    if (onComplete) {
      onComplete(planLine, statistics);
    }

    alert('計画線データを保存しました。次のステップへ進めます。');
  }, [planLine, statistics, dataType, workflow, onComplete]);

  return (
    <div className="enhanced-plan-line-editor">
      {/* ヘッダー情報 */}
      <div className="editor-header">
        <h2>{dataType === 'alignment' ? '通り' : '高低'}狂い - 計画線設定</h2>
        <div className="data-type-info">
          <span className="info-badge">
            標準範囲: ±{dataType === 'alignment' ? '10' : '30'}mm
          </span>
          {statistics && statistics.maxValue > 30 && (
            <span className="warning-badge">
              ⚠ 大きな変位あり: {statistics.maxValue.toFixed(1)}mm
            </span>
          )}
        </div>
      </div>

      {/* 統計情報パネル */}
      {statistics && (
        <div className="statistics-panel">
          <div className="stat-grid">
            <div className={`stat-item ${statistics.upwardRatio >= 0.7 ? 'good' : statistics.upwardRatio >= 0.5 ? 'normal' : 'warning'}`}>
              <label>こう上率</label>
              <div className="value">{(statistics.upwardRatio * 100).toFixed(1)}%</div>
            </div>
            <div className={`stat-item ${statistics.maxUpward <= 50 ? 'good' : 'warning'}`}>
              <label>最大こう上</label>
              <div className="value">{statistics.maxUpward.toFixed(1)}mm</div>
            </div>
            <div className={`stat-item ${statistics.maxDownward <= 20 ? 'good' : 'warning'}`}>
              <label>最大こう下</label>
              <div className="value">{statistics.maxDownward.toFixed(1)}mm</div>
            </div>
            <div className="stat-item">
              <label>データ範囲</label>
              <div className="value">{statistics.range.toFixed(1)}mm</div>
            </div>
          </div>
        </div>
      )}

      {/* グラフ表示 */}
      <div className="chart-container">
        {chartData ? (
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        ) : (
          <div className="no-data">データがありません</div>
        )}
      </div>

      {/* ズーム・パンコントロール */}
      <div className="view-controls">
        <div className="zoom-controls">
          <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}>
            ズームアウト
          </button>
          <span>ズーム: {(zoomLevel * 100).toFixed(0)}%</span>
          <button onClick={() => setZoomLevel(Math.min(5, zoomLevel + 0.1))}>
            ズームイン
          </button>
        </div>
        <div className="pan-controls">
          <input
            type="range"
            min="0"
            max={Math.max(0, restoredWaveform.length - restoredWaveform.length / zoomLevel)}
            value={panOffset}
            onChange={(e) => setPanOffset(Number(e.target.value))}
          />
        </div>
      </div>

      {/* 編集ツール */}
      <div className="editing-tools">
        <div className="mode-selector">
          <button
            className={editMode === 'view' ? 'active' : ''}
            onClick={() => setEditMode('view')}
          >
            表示モード
          </button>
          <button
            className={editMode === 'edit' ? 'active' : ''}
            onClick={() => setEditMode('edit')}
          >
            編集モード
          </button>
        </div>

        <div className="action-buttons">
          <button onClick={generateRealisticPlanLine}>
            初期値を再生成
          </button>
          <button
            onClick={savePlanLineData}
            className="save-button"
            disabled={planLine.length === 0}
          >
            保存して次へ進む
          </button>
        </div>
      </div>

      {/* デバッグ情報 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <details>
            <summary>デバッグ情報</summary>
            <pre>
              {JSON.stringify({
                dataType,
                planLinePoints: planLine.length,
                restoredPoints: restoredWaveform.length,
                statistics: statistics ? {
                  upwardRatio: `${(statistics.upwardRatio * 100).toFixed(1)}%`,
                  maxUpward: `${statistics.maxUpward.toFixed(1)}mm`,
                  maxDownward: `${statistics.maxDownward.toFixed(1)}mm`,
                  range: `${statistics.range.toFixed(1)}mm`
                } : null
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default EnhancedPlanLineEditor;