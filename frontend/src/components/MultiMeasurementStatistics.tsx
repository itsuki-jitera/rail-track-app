/**
 * 複数測定項目統計表示コンポーネント
 * 選択された各測定項目の統計情報を表示
 */

import React, { useMemo } from 'react';
import { MultiMeasurementData, MeasurementType, Statistics } from '../types';
import { MEASUREMENT_METADATA } from './MeasurementTypeSelector';

interface MultiMeasurementStatisticsProps {
  data: MultiMeasurementData[];
  selectedMeasurements: MeasurementType[];
}

const MultiMeasurementStatistics: React.FC<MultiMeasurementStatisticsProps> = ({
  data,
  selectedMeasurements
}) => {
  // 各測定項目の統計を計算
  const statistics = useMemo(() => {
    const stats: Record<MeasurementType, Statistics> = {} as any;

    selectedMeasurements.forEach(measurement => {
      const values = data
        .map(d => d.measurements[measurement])
        .filter((v): v is number => v !== undefined && v !== null);

      if (values.length === 0) {
        stats[measurement] = { min: 0, max: 0, avg: 0, stdDev: 0 };
        return;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      stats[measurement] = { min, max, avg, stdDev };
    });

    return stats;
  }, [data, selectedMeasurements]);

  if (selectedMeasurements.length === 0) {
    return null;
  }

  return (
    <div className="multi-measurement-statistics">
      <h3>統計情報</h3>
      <div className="statistics-grid">
        {selectedMeasurements.map(measurement => {
          const metadata = MEASUREMENT_METADATA[measurement];
          const stat = statistics[measurement];

          // metadataが存在しない場合のデフォルト値
          const displayMetadata = metadata || {
            label: measurement.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            color: '#6b7280',
            unit: 'mm'
          };

          return (
            <div key={measurement} className="stat-card">
              <div className="stat-header">
                <div className="stat-color" style={{ backgroundColor: displayMetadata.color }} />
                <div className="stat-title">{displayMetadata.label}</div>
              </div>
              <div className="stat-values">
                <div className="stat-item">
                  <span className="stat-label">最小値</span>
                  <span className="stat-value">{stat.min.toFixed(2)} {displayMetadata.unit}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">最大値</span>
                  <span className="stat-value">{stat.max.toFixed(2)} {displayMetadata.unit}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">平均値</span>
                  <span className="stat-value">{stat.avg.toFixed(2)} {displayMetadata.unit}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">標準偏差</span>
                  <span className="stat-value">{stat.stdDev.toFixed(2)} {displayMetadata.unit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .multi-measurement-statistics {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .multi-measurement-statistics h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .statistics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .stat-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
        }

        .stat-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }

        .stat-color {
          width: 16px;
          height: 16px;
          border-radius: 3px;
          margin-right: 8px;
        }

        .stat-title {
          font-weight: 600;
          color: #1f2937;
          font-size: 14px;
        }

        .stat-values {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .stat-item:last-child {
          border-bottom: none;
        }

        .stat-label {
          font-size: 13px;
          color: #6b7280;
        }

        .stat-value {
          font-size: 13px;
          font-weight: 500;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
};

export default MultiMeasurementStatistics;
