/**
 * 両レール表示コンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 左右両レールの同時表示
 * - 反対レールの高低はカントから計算
 * - カント差（実測値-設計値）の表示
 */

import React, { useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import './DualRailDisplay.css';

interface RailData {
  position: number;
  value: number;
}

interface CantData {
  position: number;
  actual: number;      // 実測カント
  design?: number;     // 設計カント
  difference?: number; // カント差
}

interface DualRailDisplayProps {
  leftRailData: RailData[];           // 左レール高低データ
  rightRailData?: RailData[];         // 右レール高低データ（直接指定時）
  cantData?: CantData[];              // カントデータ
  planLineLeft?: RailData[];          // 左レール計画線
  planLineRight?: RailData[];         // 右レール計画線
  workDirection?: 'up' | 'down';      // 作業方向（上り/下り）
  railGauge?: number;                 // 軌間（デフォルト1067mm）
  showCantDifference?: boolean;       // カント差表示
  showMovementAmount?: boolean;       // 移動量表示
  onDataClick?: (rail: 'left' | 'right', position: number, value: number) => void;
}

const DualRailDisplay: React.FC<DualRailDisplayProps> = ({
  leftRailData,
  rightRailData,
  cantData,
  planLineLeft,
  planLineRight,
  workDirection = 'up',
  railGauge = 1067,
  showCantDifference = true,
  showMovementAmount = true,
  onDataClick
}) => {
  // 反対レールの計算（カントベース）
  const calculatedRightRail = useMemo(() => {
    if (rightRailData) {
      return rightRailData;
    }

    if (!cantData || cantData.length === 0) {
      return [];
    }

    // 左レールデータとカントデータから右レールを計算
    return leftRailData.map(leftPoint => {
      const cantPoint = cantData.find(c =>
        Math.abs(c.position - leftPoint.position) < 0.01
      );

      if (!cantPoint) {
        return {
          position: leftPoint.position,
          value: leftPoint.value
        };
      }

      // 右レール高低 = 左レール高低 - カント（実測値）
      // 作業方向により符号調整が必要な場合
      const cantValue = workDirection === 'up' ? cantPoint.actual : -cantPoint.actual;

      return {
        position: leftPoint.position,
        value: leftPoint.value - cantValue
      };
    });
  }, [leftRailData, rightRailData, cantData, workDirection]);

  // カント差データの準備
  const cantDifferenceData = useMemo(() => {
    if (!cantData || !showCantDifference) {
      return [];
    }

    return cantData.map(cant => ({
      position: cant.position,
      value: cant.difference || (cant.design ? cant.actual - cant.design : 0)
    }));
  }, [cantData, showCantDifference]);

  // 移動量の計算（計画線との差）
  const calculateMovement = useCallback((
    rail: 'left' | 'right',
    position: number
  ): number => {
    const railData = rail === 'left' ? leftRailData : calculatedRightRail;
    const planLine = rail === 'left' ? planLineLeft : planLineRight;

    if (!planLine || planLine.length === 0) {
      return 0;
    }

    const dataPoint = railData.find(d => Math.abs(d.position - position) < 0.01);
    const planPoint = planLine.find(p => Math.abs(p.position - position) < 0.01);

    if (dataPoint && planPoint) {
      return planPoint.value - dataPoint.value;
    }

    return 0;
  }, [leftRailData, calculatedRightRail, planLineLeft, planLineRight]);

  // チャートデータの生成
  const generateChartData = () => {
    const datasets = [];

    // 左レール（復元波形）
    datasets.push({
      label: '左レール（復元波形）',
      data: leftRailData.map(d => ({ x: d.position, y: d.value })),
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      yAxisID: 'y'
    });

    // 右レール（復元波形）
    if (calculatedRightRail.length > 0) {
      datasets.push({
        label: '右レール（復元波形）',
        data: calculatedRightRail.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y'
      });
    }

    // 左レール計画線
    if (planLineLeft && planLineLeft.length > 0) {
      datasets.push({
        label: '左レール（計画線）',
        data: planLineLeft.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y'
      });
    }

    // 右レール計画線
    if (planLineRight && planLineRight.length > 0) {
      datasets.push({
        label: '右レール（計画線）',
        data: planLineRight.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y'
      });
    }

    // カント差表示
    if (cantDifferenceData.length > 0) {
      datasets.push({
        label: 'カント差',
        data: cantDifferenceData.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y1'
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
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15
        }
      },
      title: {
        display: true,
        text: '両レール表示'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y.toFixed(2);
            const position = context.parsed.x.toFixed(2);

            if (showMovementAmount && label.includes('復元波形')) {
              const rail = label.includes('左') ? 'left' : 'right';
              const movement = calculateMovement(rail as 'left' | 'right', context.parsed.x);

              if (movement !== 0) {
                const direction = movement > 0 ? '↑' : '↓';
                return `${label}: ${value}mm (移動量: ${direction}${Math.abs(movement).toFixed(2)}mm)`;
              }
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
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: '高低 (mm)'
        },
        grid: {
          drawOnChartArea: true
        }
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: 'カント差 (mm)',
          color: 'rgb(75, 192, 192)'
        },
        grid: {
          drawOnChartArea: false
        },
        display: showCantDifference
      }
    },
    onClick: (event: any, elements: any) => {
      if (elements && elements.length > 0 && onDataClick) {
        const element = elements[0];
        const datasetLabel = element.dataset.label;
        const rail = datasetLabel.includes('左') ? 'left' : 'right';
        const position = element.parsed.x;
        const value = element.parsed.y;

        onDataClick(rail as 'left' | 'right', position, value);
      }
    }
  };

  // 統計情報の計算
  const statistics = useMemo(() => {
    const calcStats = (data: RailData[]) => {
      if (data.length === 0) return null;

      const values = data.map(d => d.value);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      );
      const min = Math.min(...values);
      const max = Math.max(...values);

      return { mean, stdDev, min, max, range: max - min };
    };

    const leftStats = calcStats(leftRailData);
    const rightStats = calcStats(calculatedRightRail);

    let cantDiffStats = null;
    if (cantDifferenceData.length > 0) {
      cantDiffStats = calcStats(cantDifferenceData);
    }

    return { left: leftStats, right: rightStats, cantDiff: cantDiffStats };
  }, [leftRailData, calculatedRightRail, cantDifferenceData]);

  // 移動量の集計
  const movementSummary = useMemo(() => {
    if (!showMovementAmount || (!planLineLeft && !planLineRight)) {
      return null;
    }

    const summarize = (rail: 'left' | 'right') => {
      const planLine = rail === 'left' ? planLineLeft : planLineRight;
      if (!planLine) return null;

      let upwardCount = 0;
      let downwardCount = 0;
      let totalUpward = 0;
      let totalDownward = 0;

      planLine.forEach(point => {
        const movement = calculateMovement(rail, point.position);
        if (movement > 0) {
          upwardCount++;
          totalUpward += movement;
        } else if (movement < 0) {
          downwardCount++;
          totalDownward += Math.abs(movement);
        }
      });

      const total = upwardCount + downwardCount;
      const upwardRatio = total > 0 ? upwardCount / total : 0;

      return {
        upwardCount,
        downwardCount,
        totalUpward,
        totalDownward,
        upwardRatio,
        averageUpward: upwardCount > 0 ? totalUpward / upwardCount : 0,
        averageDownward: downwardCount > 0 ? totalDownward / downwardCount : 0
      };
    };

    return {
      left: summarize('left'),
      right: summarize('right')
    };
  }, [planLineLeft, planLineRight, showMovementAmount, calculateMovement]);

  return (
    <div className="dual-rail-display">
      {/* チャート */}
      <div className="chart-container" style={{ height: '600px' }}>
        <Line data={generateChartData()} options={chartOptions} />
      </div>

      {/* 統計情報 */}
      <div className="statistics-panel">
        <h4>統計情報</h4>

        <div className="stats-grid">
          {/* 左レール統計 */}
          {statistics.left && (
            <div className="stats-section">
              <h5>左レール</h5>
              <p>平均: {statistics.left.mean.toFixed(2)}mm</p>
              <p>標準偏差: {statistics.left.stdDev.toFixed(2)}mm</p>
              <p>最小/最大: {statistics.left.min.toFixed(2)} / {statistics.left.max.toFixed(2)}mm</p>
            </div>
          )}

          {/* 右レール統計 */}
          {statistics.right && (
            <div className="stats-section">
              <h5>右レール</h5>
              <p>平均: {statistics.right.mean.toFixed(2)}mm</p>
              <p>標準偏差: {statistics.right.stdDev.toFixed(2)}mm</p>
              <p>最小/最大: {statistics.right.min.toFixed(2)} / {statistics.right.max.toFixed(2)}mm</p>
            </div>
          )}

          {/* カント差統計 */}
          {statistics.cantDiff && (
            <div className="stats-section">
              <h5>カント差</h5>
              <p>平均: {statistics.cantDiff.mean.toFixed(2)}mm</p>
              <p>標準偏差: {statistics.cantDiff.stdDev.toFixed(2)}mm</p>
              <p>最大差: {Math.max(Math.abs(statistics.cantDiff.min), Math.abs(statistics.cantDiff.max)).toFixed(2)}mm</p>
            </div>
          )}
        </div>

        {/* 移動量サマリー */}
        {movementSummary && (
          <div className="movement-summary">
            <h5>移動量統計</h5>

            {movementSummary.left && (
              <div className="movement-section">
                <h6>左レール</h6>
                <p>こう上率: {(movementSummary.left.upwardRatio * 100).toFixed(1)}%</p>
                <p>平均こう上量: {movementSummary.left.averageUpward.toFixed(2)}mm</p>
                <p>平均こう下量: {movementSummary.left.averageDownward.toFixed(2)}mm</p>
              </div>
            )}

            {movementSummary.right && (
              <div className="movement-section">
                <h6>右レール</h6>
                <p>こう上率: {(movementSummary.right.upwardRatio * 100).toFixed(1)}%</p>
                <p>平均こう上量: {movementSummary.right.averageUpward.toFixed(2)}mm</p>
                <p>平均こう下量: {movementSummary.right.averageDownward.toFixed(2)}mm</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 凡例説明 */}
      <div className="legend-info">
        <p className="info-text">
          <span className="legend-marker left-rail"></span>
          左レール（作業方向{workDirection === 'up' ? '上り' : '下り'}）
        </p>
        <p className="info-text">
          <span className="legend-marker right-rail"></span>
          右レール（カントから計算）
        </p>
        {showCantDifference && (
          <p className="info-text">
            <span className="legend-marker cant-diff"></span>
            カント差（実測値 - 設計値）
          </p>
        )}
      </div>
    </div>
  );
};

export default DualRailDisplay;