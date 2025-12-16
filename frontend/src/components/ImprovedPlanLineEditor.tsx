/**
 * 改善版計画線エディター
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P13に基づく
 * 復元波形ベースの適切な初期値設定とリアルタイム統計表示
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useWorkflow } from './WorkflowManager';
import './ImprovedPlanLineEditor.css';

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
}

interface ImprovedPlanLineEditorProps {
  restoredWaveform?: PlanLinePoint[];
  initialPlanLine?: PlanLinePoint[];
  onPlanLineChange?: (planLine: PlanLinePoint[], stats: PlanLineStatistics) => void;
}

const ImprovedPlanLineEditor: React.FC<ImprovedPlanLineEditorProps> = ({
  restoredWaveform: propRestoredWaveform,
  initialPlanLine: propInitialPlanLine,
  onPlanLineChange
}) => {
  const workflow = useWorkflow ? useWorkflow() : null;
  const restoredWaveform = propRestoredWaveform || workflow?.restoredWaveform;

  // 初期化方法の選択
  const [initMethod, setInitMethod] = useState<'restored-based' | 'convex' | 'manual' | 'load'>('restored-based');
  const [planLine, setPlanLine] = useState<PlanLinePoint[]>([]);
  const [statistics, setStatistics] = useState<PlanLineStatistics | null>(null);
  const [editMode, setEditMode] = useState<'draw' | 'point' | 'smooth'>('draw');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // パラメータ設定
  const [params, setParams] = useState({
    smoothingFactor: 0.3,
    upwardBias: 5,
    maxUpward: 50,
    maxDownward: 10,
    autoOptimize: true
  });

  // 初期計画線の生成
  const generateInitialPlanLine = useCallback(async () => {
    if (!restoredWaveform || restoredWaveform.length === 0) {
      console.warn('復元波形データがありません');
      return;
    }

    try {
      const response = await fetch('/api/plan-line/generate-initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restoredWaveform,
          method: initMethod,
          parameters: params
        })
      });

      if (response.ok) {
        const result = await response.json();
        setPlanLine(result.planLine);
        setStatistics(result.statistics);

        // ワークフローに保存
        if (workflow) {
          workflow.updateStepData('plan-line', result.planLine);
        }

        if (onPlanLineChange) {
          onPlanLineChange(result.planLine, result.statistics);
        }
      }
    } catch (error) {
      console.error('初期計画線生成エラー:', error);
      // フォールバック：フロントエンドで簡易生成
      generateLocalPlanLine();
    }
  }, [restoredWaveform, initMethod, params, workflow, onPlanLineChange]);

  // ローカル（フロントエンド）での簡易生成
  const generateLocalPlanLine = useCallback(() => {
    if (!restoredWaveform) return;

    let newPlanLine: PlanLinePoint[] = [];

    switch (initMethod) {
      case 'restored-based':
        // 復元波形を平滑化してバイアス追加
        newPlanLine = smoothWaveform(restoredWaveform, params.smoothingFactor).map(p => ({
          position: p.position,
          value: p.value + params.upwardBias
        }));
        break;

      case 'convex':
        // 凸型生成
        const center = Math.floor(restoredWaveform.length / 2);
        newPlanLine = restoredWaveform.map((p, i) => {
          const distFromCenter = Math.abs(i - center) / center;
          const convexFactor = 1 - distFromCenter * 0.5;
          return {
            position: p.position,
            value: p.value + params.upwardBias + convexFactor * 15
          };
        });
        break;

      case 'manual':
      default:
        // 復元波形のコピー
        newPlanLine = restoredWaveform.map(p => ({ ...p }));
        break;
    }

    setPlanLine(newPlanLine);
    const stats = calculateStatistics(newPlanLine, restoredWaveform);
    setStatistics(stats);

    if (onPlanLineChange) {
      onPlanLineChange(newPlanLine, stats);
    }
  }, [restoredWaveform, initMethod, params, onPlanLineChange]);

  // 波形の平滑化
  const smoothWaveform = (waveform: PlanLinePoint[], factor: number): PlanLinePoint[] => {
    const smoothed: PlanLinePoint[] = [];
    const windowSize = Math.max(3, Math.floor(waveform.length * factor * 0.05));

    for (let i = 0; i < waveform.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -windowSize; j <= windowSize; j++) {
        const index = i + j;
        if (index >= 0 && index < waveform.length) {
          const weight = Math.exp(-(j * j) / (2 * windowSize * windowSize / 9));
          sum += waveform[index].value * weight;
          count += weight;
        }
      }

      smoothed.push({
        position: waveform[i].position,
        value: count > 0 ? sum / count : waveform[i].value
      });
    }

    return smoothed;
  };

  // 統計情報の計算
  const calculateStatistics = (
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
      avgDownward: 0
    };

    let totalUpward = 0;
    let totalDownward = 0;

    for (let i = 0; i < planLine.length; i++) {
      const movement = planLine[i].value - restoredWaveform[i].value;

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

    stats.upwardRatio = stats.upwardPoints / stats.totalPoints;
    stats.avgUpward = stats.upwardPoints > 0 ? totalUpward / stats.upwardPoints : 0;
    stats.avgDownward = stats.downwardPoints > 0 ? totalDownward / stats.downwardPoints : 0;

    return stats;
  };

  // グラフデータの準備
  const chartData = useMemo(() => {
    if (!restoredWaveform || planLine.length === 0) return null;

    return {
      labels: restoredWaveform.map(p => p.position.toFixed(3)),
      datasets: [
        {
          label: '復元波形',
          data: restoredWaveform.map(p => p.value),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: '計画線',
          data: planLine.map(p => p.value),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderWidth: 2,
          pointRadius: editMode === 'point' ? 3 : 0,
          pointHoverRadius: 5
        }
      ]
    };
  }, [restoredWaveform, planLine, editMode]);

  // 初期化
  useEffect(() => {
    if (propInitialPlanLine) {
      setPlanLine(propInitialPlanLine);
    } else if (restoredWaveform && planLine.length === 0) {
      generateInitialPlanLine();
    }
  }, [restoredWaveform, propInitialPlanLine]);

  // 統計情報の更新
  useEffect(() => {
    if (restoredWaveform && planLine.length > 0) {
      const stats = calculateStatistics(planLine, restoredWaveform);
      setStatistics(stats);
    }
  }, [planLine, restoredWaveform]);

  // こう上優先最適化
  const optimizePlanLine = useCallback(async () => {
    if (!restoredWaveform || planLine.length === 0) return;

    try {
      const response = await fetch('/api/plan-line/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restoredWaveform,
          planLine,
          targetUpwardRatio: 0.7,
          maxUpward: params.maxUpward,
          maxDownward: params.maxDownward
        })
      });

      if (response.ok) {
        const result = await response.json();
        setPlanLine(result.optimizedPlanLine);
        setStatistics(result.statistics);

        if (onPlanLineChange) {
          onPlanLineChange(result.optimizedPlanLine, result.statistics);
        }
      }
    } catch (error) {
      console.error('最適化エラー:', error);
    }
  }, [restoredWaveform, planLine, params, onPlanLineChange]);

  return (
    <div className="improved-plan-line-editor">
      {/* 初期化オプション */}
      <div className="initialization-panel">
        <h3>計画線の初期化</h3>
        <div className="init-methods">
          <label className={initMethod === 'restored-based' ? 'selected' : ''}>
            <input
              type="radio"
              value="restored-based"
              checked={initMethod === 'restored-based'}
              onChange={(e) => setInitMethod(e.target.value as any)}
            />
            復元波形ベース（推奨）
          </label>
          <label className={initMethod === 'convex' ? 'selected' : ''}>
            <input
              type="radio"
              value="convex"
              checked={initMethod === 'convex'}
              onChange={(e) => setInitMethod(e.target.value as any)}
            />
            凸型自動生成
          </label>
          <label className={initMethod === 'manual' ? 'selected' : ''}>
            <input
              type="radio"
              value="manual"
              checked={initMethod === 'manual'}
              onChange={(e) => setInitMethod(e.target.value as any)}
            />
            手動調整
          </label>
        </div>

        {/* パラメータ設定 */}
        <div className="parameters">
          <div className="param-row">
            <label>
              平滑化係数:
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={params.smoothingFactor}
                onChange={(e) => setParams({ ...params, smoothingFactor: parseFloat(e.target.value) })}
              />
              <span>{params.smoothingFactor.toFixed(1)}</span>
            </label>
          </div>
          <div className="param-row">
            <label>
              初期こう上量:
              <input
                type="number"
                min="0"
                max="20"
                value={params.upwardBias}
                onChange={(e) => setParams({ ...params, upwardBias: parseFloat(e.target.value) })}
              />
              mm
            </label>
          </div>
        </div>

        <button className="generate-btn" onClick={generateInitialPlanLine}>
          計画線を生成
        </button>
      </div>

      {/* リアルタイム統計表示 */}
      {statistics && (
        <div className="statistics-panel">
          <h3>計画線統計</h3>
          <div className="stats-grid">
            <div className="stat-item highlight">
              <label>こう上率</label>
              <div className={`value ${statistics.upwardRatio >= 0.7 ? 'good' : statistics.upwardRatio >= 0.5 ? 'warning' : 'bad'}`}>
                {(statistics.upwardRatio * 100).toFixed(1)}%
              </div>
            </div>
            <div className="stat-item">
              <label>最大こう上</label>
              <div className="value">{statistics.maxUpward.toFixed(1)}mm</div>
            </div>
            <div className="stat-item">
              <label>最大こう下</label>
              <div className="value">{statistics.maxDownward.toFixed(1)}mm</div>
            </div>
            <div className="stat-item">
              <label>平均こう上</label>
              <div className="value">{statistics.avgUpward.toFixed(1)}mm</div>
            </div>
            <div className="stat-item">
              <label>平均こう下</label>
              <div className="value">{statistics.avgDownward.toFixed(1)}mm</div>
            </div>
            <div className="stat-item">
              <label>こう上点数</label>
              <div className="value">{statistics.upwardPoints}/{statistics.totalPoints}</div>
            </div>
          </div>

          {statistics.upwardRatio < 0.7 && (
            <div className="optimization-suggestion">
              <p>⚠ こう上率が目標値（70%）未満です</p>
              <button className="optimize-btn" onClick={optimizePlanLine}>
                こう上優先最適化を実行
              </button>
            </div>
          )}
        </div>
      )}

      {/* グラフ表示 */}
      {chartData && (
        <div className="chart-container">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: '復元波形と計画線'
                },
                legend: {
                  position: 'top'
                },
                tooltip: {
                  mode: 'index',
                  intersect: false
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
                  title: {
                    display: true,
                    text: '変位 (mm)'
                  }
                }
              }
            }}
          />
        </div>
      )}

      {/* 編集ツール */}
      <div className="editing-tools">
        <div className="tool-buttons">
          <button
            className={editMode === 'draw' ? 'active' : ''}
            onClick={() => setEditMode('draw')}
          >
            描画
          </button>
          <button
            className={editMode === 'point' ? 'active' : ''}
            onClick={() => setEditMode('point')}
          >
            点編集
          </button>
          <button
            className={editMode === 'smooth' ? 'active' : ''}
            onClick={() => setEditMode('smooth')}
          >
            平滑化
          </button>
        </div>

        <div className="action-buttons">
          <button onClick={() => setPlanLine(smoothWaveform(planLine, 0.3))}>
            全体を平滑化
          </button>
          <button onClick={generateInitialPlanLine}>
            リセット
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImprovedPlanLineEditor;