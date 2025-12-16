/**
 * 移動量補正モードセレクター
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P8-11に基づく
 * 補正モード（無/有/M）の選択UI
 */

import React, { useState, useCallback } from 'react';
import './CorrectionModeSelector.css';

interface CorrectionModeInfo {
  mode: 'none' | 'standard' | 'mtt';
  label: string;
  shortDesc: string;
  longDesc: string;
  formula: string;
  useCase: string;
}

interface MTTType {
  id: string;
  name: string;
  bcDistance: number;
  cdDistance: number;
}

interface CorrectionModeSelectorProps {
  currentMode?: 'none' | 'standard' | 'mtt';
  currentMTTType?: string;
  onModeChange?: (mode: 'none' | 'standard' | 'mtt') => void;
  onMTTTypeChange?: (mttType: string) => void;
  disabled?: boolean;
}

const CorrectionModeSelector: React.FC<CorrectionModeSelectorProps> = ({
  currentMode = 'none',
  currentMTTType = '08-475',
  onModeChange,
  onMTTTypeChange,
  disabled = false
}) => {
  const [selectedMode, setSelectedMode] = useState<'none' | 'standard' | 'mtt'>(currentMode);
  const [selectedMTT, setSelectedMTT] = useState(currentMTTType);
  const [showDetails, setShowDetails] = useState(false);

  // 補正モード情報
  const correctionModes: CorrectionModeInfo[] = [
    {
      mode: 'none',
      label: '無',
      shortDesc: 'こう上量のみ',
      longDesc: '復元波形と計画線との差分（こう上量）をそのまま移動量とします。',
      formula: '移動量 = 計画線 - 復元波形',
      useCase: '通常の軌道整正作業'
    },
    {
      mode: 'standard',
      label: '有',
      shortDesc: 'こう上量 + 歪み補正',
      longDesc: 'こう上量に加えて、計画線の歪み（曲率変化）に対する補正量を追加します。',
      formula: '移動量 = (計画線 - 復元波形) + 歪み補正量',
      useCase: '曲線区間や変化の大きい箇所での作業'
    },
    {
      mode: 'mtt',
      label: 'M',
      shortDesc: 'こう上量 + MTT偏心矢×3',
      longDesc: 'こう上量に加えて、整備後予測波形の偏心矢の約3倍を補正量として追加します。',
      formula: '移動量 = (計画線 - 復元波形) + (偏心矢 × 3)',
      useCase: 'MTT機械特性を考慮した精密な作業'
    }
  ];

  // MTT機種リスト
  const mttTypes: MTTType[] = [
    { id: '08-475', name: '08-475型（標準）', bcDistance: 3.63, cdDistance: 9.37 },
    { id: '08-275', name: '08-275型', bcDistance: 3.2, cdDistance: 8.5 },
    { id: '09-16', name: '09-16在', bcDistance: 7.5, cdDistance: 7.5 },
    { id: '09-32', name: '09-32型', bcDistance: 8.0, cdDistance: 8.0 },
    { id: 'MTT-15', name: 'MTT-15（新型）', bcDistance: 10.0, cdDistance: 10.0 }
  ];

  // モード変更ハンドラ
  const handleModeChange = useCallback((mode: 'none' | 'standard' | 'mtt') => {
    setSelectedMode(mode);
    if (onModeChange) {
      onModeChange(mode);
    }
  }, [onModeChange]);

  // MTT機種変更ハンドラ
  const handleMTTChange = useCallback((mttType: string) => {
    setSelectedMTT(mttType);
    if (onMTTTypeChange) {
      onMTTTypeChange(mttType);
    }
  }, [onMTTTypeChange]);

  const selectedModeInfo = correctionModes.find(m => m.mode === selectedMode);
  const selectedMTTInfo = mttTypes.find(m => m.id === selectedMTT);

  return (
    <div className="correction-mode-selector">
      <div className="selector-header">
        <h3>移動量補正設定</h3>
        <button
          className="detail-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '詳細を隠す' : '詳細を表示'}
        </button>
      </div>

      {/* 補正モード選択 */}
      <div className="mode-selection">
        <label className="selection-label">補正モード選択</label>
        <div className="mode-buttons">
          {correctionModes.map(mode => (
            <button
              key={mode.mode}
              className={`mode-button ${selectedMode === mode.mode ? 'selected' : ''}`}
              onClick={() => handleModeChange(mode.mode)}
              disabled={disabled}
            >
              <div className="mode-label">{mode.label}</div>
              <div className="mode-desc">{mode.shortDesc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* MTT機種選択（Mモードの場合のみ表示） */}
      {selectedMode === 'mtt' && (
        <div className="mtt-selection">
          <label className="selection-label">MTT機種選択</label>
          <select
            value={selectedMTT}
            onChange={e => handleMTTChange(e.target.value)}
            disabled={disabled}
            className="mtt-select"
          >
            {mttTypes.map(mtt => (
              <option key={mtt.id} value={mtt.id}>
                {mtt.name} (BC間: {mtt.bcDistance}m, CD間: {mtt.cdDistance}m)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 選択された補正モードの詳細 */}
      {selectedModeInfo && (
        <div className="mode-info">
          <div className="info-summary">
            <span className="info-label">現在の設定:</span>
            <span className="info-value">
              {selectedModeInfo.label} - {selectedModeInfo.shortDesc}
              {selectedMode === 'mtt' && selectedMTTInfo && (
                <span className="mtt-info"> ({selectedMTTInfo.name})</span>
              )}
            </span>
          </div>

          {showDetails && (
            <div className="info-details">
              <div className="detail-section">
                <h4>説明</h4>
                <p>{selectedModeInfo.longDesc}</p>
              </div>

              <div className="detail-section">
                <h4>計算式</h4>
                <code className="formula">{selectedModeInfo.formula}</code>
              </div>

              <div className="detail-section">
                <h4>使用場面</h4>
                <p>{selectedModeInfo.useCase}</p>
              </div>

              {selectedMode === 'mtt' && selectedMTTInfo && (
                <div className="detail-section">
                  <h4>MTT機種仕様</h4>
                  <div className="mtt-specs">
                    <div className="spec-item">
                      <span className="spec-label">機種名:</span>
                      <span className="spec-value">{selectedMTTInfo.name}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">BC間距離:</span>
                      <span className="spec-value">{selectedMTTInfo.bcDistance}m</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">CD間距離:</span>
                      <span className="spec-value">{selectedMTTInfo.cdDistance}m</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 警告メッセージ */}
      {selectedMode === 'mtt' && (
        <div className="warning-message">
          <span className="warning-icon">⚠</span>
          <span>MTT補正（M）を選択した場合、計算に時間がかかる場合があります。</span>
        </div>
      )}

      {/* 推奨設定 */}
      <div className="recommendation">
        <h4>推奨設定</h4>
        <ul>
          <li>
            <strong>通常作業:</strong> 「無」を選択
          </li>
          <li>
            <strong>曲線区間:</strong> 「有」を選択
          </li>
          <li>
            <strong>高精度作業:</strong> 「M」を選択し、使用するMTT機種を指定
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CorrectionModeSelector;