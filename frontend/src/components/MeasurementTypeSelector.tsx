/**
 * 測定項目選択コンポーネント
 * 複数の測定項目（高低、水準、通り等）を選択するUI
 */

import React from 'react';
import { MeasurementType, MeasurementTypeMetadata } from '../types';

interface MeasurementTypeSelectorProps {
  availableMeasurements: MeasurementType[];
  selectedMeasurements: MeasurementType[];
  onSelectionChange: (selected: MeasurementType[]) => void;
}

// 測定項目のメタデータ
export const MEASUREMENT_METADATA: Record<MeasurementType, MeasurementTypeMetadata> = {
  elevation_left: {
    key: 'elevation_left',
    label: '高低（左）',
    unit: 'mm',
    color: '#3b82f6',
    description: '左レールの高低狂い'
  },
  elevation_right: {
    key: 'elevation_right',
    label: '高低（右）',
    unit: 'mm',
    color: '#ef4444',
    description: '右レールの高低狂い'
  },
  level_left: {
    key: 'level_left',
    label: '水準（左）',
    unit: 'mm',
    color: '#10b981',
    description: '左レールの水準狂い'
  },
  level_right: {
    key: 'level_right',
    label: '水準（右）',
    unit: 'mm',
    color: '#f59e0b',
    description: '右レールの水準狂い'
  },
  alignment_left: {
    key: 'alignment_left',
    label: '通り（左）',
    unit: 'mm',
    color: '#8b5cf6',
    description: '左レールの通り狂い'
  },
  alignment_right: {
    key: 'alignment_right',
    label: '通り（右）',
    unit: 'mm',
    color: '#ec4899',
    description: '右レールの通り狂い'
  },
  gauge: {
    key: 'gauge',
    label: '軌間',
    unit: 'mm',
    color: '#06b6d4',
    description: '軌間（ゲージ）'
  }
};

const MeasurementTypeSelector: React.FC<MeasurementTypeSelectorProps> = ({
  availableMeasurements,
  selectedMeasurements,
  onSelectionChange
}) => {
  const handleToggle = (measurement: MeasurementType) => {
    if (selectedMeasurements.includes(measurement)) {
      // 選択解除
      onSelectionChange(selectedMeasurements.filter(m => m !== measurement));
    } else {
      // 選択追加
      onSelectionChange([...selectedMeasurements, measurement]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(availableMeasurements);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="measurement-selector">
      <div className="selector-header">
        <h3>測定項目選択</h3>
        <div className="selector-actions">
          <button
            onClick={handleSelectAll}
            className="btn-small"
            disabled={selectedMeasurements.length === availableMeasurements.length}
          >
            すべて選択
          </button>
          <button
            onClick={handleClearAll}
            className="btn-small"
            disabled={selectedMeasurements.length === 0}
          >
            すべて解除
          </button>
        </div>
      </div>

      <div className="measurement-list">
        {availableMeasurements.map(measurement => {
          const metadata = MEASUREMENT_METADATA[measurement];
          const isSelected = selectedMeasurements.includes(measurement);

          // metadataが存在しない場合は、デフォルト値を使用
          const displayMetadata = metadata || {
            key: measurement,
            label: measurement.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            unit: 'mm',
            color: '#6b7280',
            description: `測定項目: ${measurement}`
          };

          return (
            <div
              key={measurement}
              className={`measurement-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleToggle(measurement)}
            >
              <div className="measurement-checkbox">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(measurement)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="measurement-color" style={{ backgroundColor: displayMetadata.color }} />
              <div className="measurement-info">
                <div className="measurement-label">{displayMetadata.label}</div>
                <div className="measurement-description">{displayMetadata.description}</div>
              </div>
              <div className="measurement-unit">{displayMetadata.unit}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .measurement-selector {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .selector-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .selector-actions {
          display: flex;
          gap: 8px;
        }

        .btn-small {
          padding: 4px 12px;
          font-size: 12px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-small:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .btn-small:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .measurement-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .measurement-item {
          display: flex;
          align-items: center;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .measurement-item:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .measurement-item.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .measurement-checkbox {
          margin-right: 12px;
        }

        .measurement-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .measurement-color {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .measurement-info {
          flex: 1;
        }

        .measurement-label {
          font-weight: 500;
          color: #1f2937;
          margin-bottom: 2px;
        }

        .measurement-description {
          font-size: 12px;
          color: #6b7280;
        }

        .measurement-unit {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default MeasurementTypeSelector;
