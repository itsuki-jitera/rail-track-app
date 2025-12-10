/**
 * 復元波形グラフ表示コンポーネント
 *
 * 表示内容:
 * - 現況測定波形（元データ）
 * - 復元波形（6m-40m波長成分）
 * - 計画線（ゼロクロス点を結んだ目標線）
 * - 移動量（復元波形 - 計画線）
 */

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { RestorationWaveformResult, DataPoint } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface RestorationWaveformChartProps {
  originalData: DataPoint[];
  result: RestorationWaveformResult;
  measurementLabel: string;
}

const RestorationWaveformChart: React.FC<RestorationWaveformChartProps> = ({
  originalData,
  result,
  measurementLabel
}) => {
  const chartData = useMemo(() => {
    if (!result.success || !result.data) {
      return { labels: [], datasets: [] };
    }

    const { restorationWaveform, planLine, movementAmounts } = result.data;

    // X軸ラベル（距離）
    const labels = restorationWaveform.map(d => d.distance.toFixed(1));

    return {
      labels,
      datasets: [
        {
          label: '現況測定波形',
          data: originalData.map(d => ({ x: d.distance, y: d.value })),
          borderColor: '#9ca3af',
          backgroundColor: '#9ca3af20',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderDash: [5, 5],
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: '復元波形 (6m-40m)',
          data: restorationWaveform.map(d => ({ x: d.distance, y: d.value })),
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f620',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: '計画線',
          data: planLine.map(d => ({ x: d.distance, y: d.value })),
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderDash: [10, 5],
          tension: 0,
          yAxisID: 'y'
        },
        {
          label: '移動量',
          data: movementAmounts.map(d => ({ x: d.distance, y: d.amount })),
          borderColor: '#ef4444',
          backgroundColor: '#ef444420',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1,
          yAxisID: 'y'
        }
      ]
    };
  }, [originalData, result]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: `復元波形計算結果 - ${measurementLabel}`,
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value !== null ? value.toFixed(2) : 'N/A'} mm`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: '距離 (m)',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      y: {
        title: {
          display: true,
          text: '軌道狂い / 移動量 (mm)',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  }), [measurementLabel]);

  if (!result.success || !result.data) {
    return (
      <div className="restoration-chart-error">
        <p>計算結果を表示できません</p>
        {result.error && <p className="error-detail">{result.error}</p>}
      </div>
    );
  }

  return (
    <div className="restoration-waveform-chart">
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>

      {/* メタデータ表示 */}
      <div className="metadata-section">
        <h4>計算情報</h4>
        <div className="metadata-grid">
          <div className="metadata-item">
            <span className="metadata-label">元データ点数:</span>
            <span className="metadata-value">{result.data.metadata.originalDataPoints}点</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">リサンプリング後:</span>
            <span className="metadata-value">{result.data.metadata.resampledDataPoints}点</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">FFTサイズ:</span>
            <span className="metadata-value">{result.data.metadata.fftSize}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">ゼロクロス点:</span>
            <span className="metadata-value">{result.data.metadata.zeroCrossCount}点</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">復元波長範囲:</span>
            <span className="metadata-value">
              {result.data.metadata.minWavelength}m - {result.data.metadata.maxWavelength}m
            </span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">サンプリング間隔:</span>
            <span className="metadata-value">{result.data.metadata.samplingInterval}m</span>
          </div>
        </div>
      </div>

      {/* ゼロクロス点情報 */}
      {result.data.zeroCrossPoints.length > 0 && (
        <div className="zerocross-section">
          <h4>ゼロクロス点 ({result.data.zeroCrossPoints.length}点)</h4>
          <div className="zerocross-list">
            {result.data.zeroCrossPoints.slice(0, 10).map((point, idx) => (
              <span key={idx} className={`zerocross-badge ${point.type}`}>
                {point.distance.toFixed(1)}m
                <span className="zerocross-type">
                  {point.type === 'ascending' ? '↑' : '↓'}
                </span>
              </span>
            ))}
            {result.data.zeroCrossPoints.length > 10 && (
              <span className="zerocross-more">
                ... 他{result.data.zeroCrossPoints.length - 10}点
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        .restoration-waveform-chart {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .chart-container {
          height: 500px;
          margin-bottom: 16px;
        }

        .restoration-chart-error {
          padding: 24px;
          text-align: center;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
        }

        .error-detail {
          margin-top: 8px;
          font-size: 12px;
          color: #991b1b;
        }

        .metadata-section {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .metadata-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }

        .metadata-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .metadata-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: white;
          border-radius: 4px;
        }

        .metadata-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .metadata-value {
          font-size: 12px;
          color: #1f2937;
          font-weight: 600;
        }

        .zerocross-section {
          background: #f0f9ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 12px;
        }

        .zerocross-section h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 600;
          color: #1e40af;
        }

        .zerocross-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .zerocross-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #3b82f6;
          color: white;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .zerocross-badge.ascending {
          background: #10b981;
        }

        .zerocross-badge.descending {
          background: #f59e0b;
        }

        .zerocross-type {
          font-size: 14px;
        }

        .zerocross-more {
          padding: 4px 8px;
          color: #6b7280;
          font-size: 11px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default RestorationWaveformChart;
