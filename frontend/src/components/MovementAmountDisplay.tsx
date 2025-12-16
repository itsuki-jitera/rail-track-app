/**
 * 移動量表示コンポーネント
 * 復元波形から計画線への移動量を視覚的に表示
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 復元波形が実際の軌道形状を表す
 * - これをゼロ点（計画線）まで移動する量を移動量とする
 * - 移動量制限によってゼロ点まで移動できない場合は計画線を変更
 */

import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './MovementAmountDisplay.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MovementData {
  position: number;           // 位置 (m)
  currentHeight: number;       // 現在高さ（復元波形）(mm)
  targetHeight: number;        // 目標高さ（計画線）(mm)
  movementAmount: number;      // 移動量 (mm)
  constraint?: number;         // 移動量制限 (mm)
  direction: 'up' | 'down';    // 移動方向
  isConstrained?: boolean;     // 制限超過フラグ
  isWBSection?: boolean;       // WB区間フラグ
}

interface MovementAmountDisplayProps {
  movementData: MovementData[];
  workDirection?: 'forward' | 'backward';
  railSide?: 'left' | 'right';
  dataType?: 'level' | 'alignment';
  showStatistics?: boolean;
  highlightConstraints?: boolean;
  maxUpwardMovement?: number;
  maxDownwardMovement?: number;
}

const MovementAmountDisplay: React.FC<MovementAmountDisplayProps> = ({
  movementData,
  workDirection = 'forward',
  railSide = 'left',
  dataType = 'level',
  showStatistics = true,
  highlightConstraints = true,
  maxUpwardMovement = 50,
  maxDownwardMovement = 10
}) => {
  const [displayMode, setDisplayMode] = useState<'combined' | 'separate' | 'difference'>('combined');
  const [showLimits, setShowLimits] = useState(true);

  // 統計情報の計算
  const statistics = useMemo(() => {
    const upMovements = movementData.filter(d => d.direction === 'up');
    const downMovements = movementData.filter(d => d.direction === 'down');
    const constrainedPoints = movementData.filter(d => d.isConstrained);

    const upAmounts = upMovements.map(d => Math.abs(d.movementAmount));
    const downAmounts = downMovements.map(d => Math.abs(d.movementAmount));

    return {
      totalPoints: movementData.length,
      upwardPoints: upMovements.length,
      downwardPoints: downMovements.length,
      constrainedPoints: constrainedPoints.length,
      averageUpward: upAmounts.length > 0
        ? upAmounts.reduce((a, b) => a + b, 0) / upAmounts.length
        : 0,
      averageDownward: downAmounts.length > 0
        ? downAmounts.reduce((a, b) => a + b, 0) / downAmounts.length
        : 0,
      maxUpward: upAmounts.length > 0 ? Math.max(...upAmounts) : 0,
      maxDownward: downAmounts.length > 0 ? Math.max(...downAmounts) : 0,
      upwardRatio: (upMovements.length / movementData.length) * 100,
      constrainedRatio: (constrainedPoints.length / movementData.length) * 100
    };
  }, [movementData]);

  // チャートデータの準備
  const chartData = useMemo(() => {
    const labels = movementData.map(d => d.position.toFixed(1));

    const datasets = [];

    // 複合表示モード
    if (displayMode === 'combined') {
      // 復元波形
      datasets.push({
        label: `復元波形 (${railSide === 'left' ? '左' : '右'}レール)`,
        data: movementData.map(d => d.currentHeight),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.1,
        pointRadius: 1,
        borderWidth: 2
      });

      // 計画線
      datasets.push({
        label: '計画線（目標）',
        data: movementData.map(d => d.targetHeight),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0.1,
        pointRadius: 1,
        borderWidth: 2,
        borderDash: [5, 5]
      });

      // 移動量を塗りつぶしで表示
      if (highlightConstraints) {
        const constrainedData = movementData.map(d =>
          d.isConstrained ? d.currentHeight : null
        );
        datasets.push({
          label: '制限超過箇所',
          data: constrainedData,
          backgroundColor: 'rgba(255, 0, 0, 0.3)',
          borderColor: 'rgba(255, 0, 0, 0.8)',
          pointRadius: 3,
          pointStyle: 'triangle'
        });
      }
    }

    // 移動量のみ表示モード
    if (displayMode === 'separate' || displayMode === 'difference') {
      datasets.push({
        label: '移動量',
        data: movementData.map(d => d.movementAmount),
        backgroundColor: movementData.map(d => {
          if (d.isConstrained) return 'rgba(255, 0, 0, 0.6)';
          return d.direction === 'up'
            ? 'rgba(54, 162, 235, 0.6)'
            : 'rgba(255, 206, 86, 0.6)';
        }),
        borderColor: movementData.map(d => {
          if (d.isConstrained) return 'rgba(255, 0, 0, 1)';
          return d.direction === 'up'
            ? 'rgba(54, 162, 235, 1)'
            : 'rgba(255, 206, 86, 1)';
        }),
        borderWidth: 1
      });

      // 移動量制限ライン
      if (showLimits) {
        datasets.push({
          label: '上方向制限',
          data: new Array(movementData.length).fill(maxUpwardMovement),
          borderColor: 'rgba(0, 128, 0, 0.5)',
          borderDash: [10, 5],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        });

        datasets.push({
          label: '下方向制限',
          data: new Array(movementData.length).fill(-maxDownwardMovement),
          borderColor: 'rgba(128, 0, 0, 0.5)',
          borderDash: [10, 5],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        });
      }
    }

    // WB区間のマーカー
    const wbMarkers = movementData.map(d => d.isWBSection ? 0 : null);
    if (wbMarkers.some(m => m !== null)) {
      datasets.push({
        label: 'WB区間',
        data: wbMarkers,
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        borderColor: 'rgba(255, 165, 0, 0.5)',
        borderWidth: 0,
        pointRadius: 0,
        fill: true
      });
    }

    return { labels, datasets };
  }, [movementData, displayMode, highlightConstraints, showLimits,
      maxUpwardMovement, maxDownwardMovement, railSide]);

  // チャートオプション
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `移動量表示 - ${dataType === 'level' ? '高低' : '通り'}狂い [${workDirection === 'forward' ? '下り' : '上り'}方向]`,
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          afterLabel: function(context: any) {
            const index = context.dataIndex;
            const data = movementData[index];
            if (!data) return '';

            const lines = [];
            lines.push(`移動量: ${data.movementAmount.toFixed(2)}mm`);
            lines.push(`方向: ${data.direction === 'up' ? '上方向↑' : '下方向↓'}`);

            if (data.isConstrained) {
              lines.push('⚠️ 制限超過');
            }
            if (data.constraint) {
              lines.push(`制限値: ±${data.constraint}mm`);
            }
            if (data.isWBSection) {
              lines.push('📍 WB区間');
            }

            return lines;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `位置 (m) ${workDirection === 'forward' ? '→' : '←'}`
        },
        reverse: workDirection === 'backward'
      },
      y: {
        title: {
          display: true,
          text: displayMode === 'difference'
            ? '移動量 (mm) ↑上方向 | 下方向↓'
            : `${dataType === 'level' ? '高低' : '通り'} (mm)`
        },
        grid: {
          drawBorder: true,
          color: (context: any) => {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.5)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          }
        }
      }
    }
  };

  return (
    <div className="movement-amount-display">
      {/* コントロールパネル */}
      <div className="control-panel">
        <div className="display-mode-selector">
          <label>表示モード:</label>
          <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value as any)}>
            <option value="combined">復元波形＋計画線</option>
            <option value="separate">移動量のみ</option>
            <option value="difference">移動量（棒グラフ）</option>
          </select>
        </div>

        <div className="option-toggles">
          <label>
            <input
              type="checkbox"
              checked={showLimits}
              onChange={(e) => setShowLimits(e.target.checked)}
            />
            制限ライン表示
          </label>
          <label>
            <input
              type="checkbox"
              checked={highlightConstraints}
              onChange={(e) => setHighlightConstraints(e.target.checked)}
            />
            制限超過強調
          </label>
        </div>
      </div>

      {/* チャート表示 */}
      <div className="chart-container" style={{ height: '400px' }}>
        {displayMode === 'difference' ? (
          <Bar data={chartData} options={chartOptions} />
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>

      {/* 統計情報表示 */}
      {showStatistics && (
        <div className="statistics-panel">
          <h3>移動量統計</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <label>総データ点数:</label>
              <span>{statistics.totalPoints}</span>
            </div>
            <div className="stat-item">
              <label>上方向移動:</label>
              <span className="up-movement">
                {statistics.upwardPoints}点 ({statistics.upwardRatio.toFixed(1)}%)
              </span>
            </div>
            <div className="stat-item">
              <label>下方向移動:</label>
              <span className="down-movement">
                {statistics.downwardPoints}点
              </span>
            </div>
            <div className="stat-item">
              <label>平均上方向:</label>
              <span>{statistics.averageUpward.toFixed(2)}mm</span>
            </div>
            <div className="stat-item">
              <label>平均下方向:</label>
              <span>{statistics.averageDownward.toFixed(2)}mm</span>
            </div>
            <div className="stat-item">
              <label>最大上方向:</label>
              <span>{statistics.maxUpward.toFixed(2)}mm</span>
            </div>
            <div className="stat-item">
              <label>最大下方向:</label>
              <span>{statistics.maxDownward.toFixed(2)}mm</span>
            </div>
            <div className="stat-item warning">
              <label>制限超過:</label>
              <span>
                {statistics.constrainedPoints}点 ({statistics.constrainedRatio.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* こう上優先の評価 */}
          <div className="evaluation-panel">
            <h4>こう上優先評価</h4>
            <div className={`evaluation-result ${statistics.upwardRatio >= 70 ? 'good' : 'warning'}`}>
              {statistics.upwardRatio >= 70 ? (
                <span>✅ 良好: こう上率 {statistics.upwardRatio.toFixed(1)}% (目標70%以上)</span>
              ) : (
                <span>⚠️ 要改善: こう上率 {statistics.upwardRatio.toFixed(1)}% (目標70%未達)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovementAmountDisplay;