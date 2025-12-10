/**
 * 複数測定項目グラフ表示コンポーネント
 * 選択された複数の測定項目を同時にグラフ表示
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
import { MultiMeasurementData, MeasurementType } from '../types';
import { MEASUREMENT_METADATA } from './MeasurementTypeSelector';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MultiMeasurementChartProps {
  data: MultiMeasurementData[];
  selectedMeasurements: MeasurementType[];
  title?: string;
}

const MultiMeasurementChart: React.FC<MultiMeasurementChartProps> = ({
  data,
  selectedMeasurements,
  title = '測定データグラフ'
}) => {
  const chartData = useMemo(() => {
    // 距離データ（X軸）
    const labels = data.map(d => d.distance.toFixed(1));

    // 各測定項目のデータセット
    const datasets = selectedMeasurements.map(measurement => {
      const metadata = MEASUREMENT_METADATA[measurement];
      const values = data.map(d => d.measurements[measurement] ?? null);

      // metadataが存在しない場合のデフォルト値
      const displayMetadata = metadata || {
        label: measurement.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        color: '#6b7280',
        unit: 'mm'
      };

      return {
        label: displayMetadata.label,
        data: values,
        borderColor: displayMetadata.color,
        backgroundColor: displayMetadata.color + '20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        spanGaps: true
      };
    });

    return {
      labels,
      datasets
    };
  }, [data, selectedMeasurements]);

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
        text: title,
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
            const metadata = MEASUREMENT_METADATA[selectedMeasurements[context.datasetIndex]];
            const unit = metadata?.unit || 'mm';
            return `${label}: ${value !== null ? value.toFixed(2) : 'N/A'} ${unit}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '距離 (m)',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          maxTicksLimit: 20,
          font: {
            size: 11
          }
        }
      },
      y: {
        title: {
          display: true,
          text: '測定値 (mm)',
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
  }), [title, selectedMeasurements]);

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <p>表示するデータがありません</p>
      </div>
    );
  }

  if (selectedMeasurements.length === 0) {
    return (
      <div className="chart-empty">
        <p>測定項目を選択してください</p>
      </div>
    );
  }

  return (
    <div className="multi-measurement-chart">
      <div className="chart-container">
        <Line data={chartData} options={options} />
      </div>

      <style>{`
        .multi-measurement-chart {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .chart-container {
          height: 400px;
          position: relative;
        }

        .chart-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          background: #f9fafb;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          color: #6b7280;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default MultiMeasurementChart;
