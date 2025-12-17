/**
 * MTT機種設定ページ
 * PDF P23の仕様に基づく実装
 */

import React, { useState, useEffect } from 'react';
import { PresetButtons } from '../components/StandardButton';
import MTTGuidancePanel from '../components/MTTGuidancePanel';
import './PageStyles.css';

interface MTTType {
  value: string;
  label: string;
  config: {
    leveling: { bcLength: number; cdLength: number };
    lining: { bcLength: number; cdLength: number };
  };
}

export const MTTSettingsPage: React.FC = () => {
  const [mttTypes, setMttTypes] = useState<MTTType[]>([]);
  const [selectedMTT, setSelectedMTT] = useState<string>('08-16');
  const [mttConfig, setMttConfig] = useState<any>(null);
  const [corrections, setCorrections] = useState({
    levelingCorrection: true,
    liningCorrection: true,
    correctionRate: 1.0
  });

  // MTT誘導パネルの表示制御
  const [showGuidancePanel, setShowGuidancePanel] = useState(false);

  useEffect(() => {
    fetchMTTTypes();
  }, []);

  const fetchMTTTypes = async () => {
    try {
      const response = await fetch('/api/mtt-types');
      const data = await response.json();
      if (data.success) {
        setMttTypes(data.data);
      }
    } catch (error) {
      console.error('MTT機種取得エラー:', error);
    }
  };

  const handleMTTChange = async (mttType: string) => {
    setSelectedMTT(mttType);
    try {
      const response = await fetch(`/api/mtt-types/${mttType}`);
      const data = await response.json();
      if (data.success) {
        setMttConfig(data.data);
      }
    } catch (error) {
      console.error('MTT詳細取得エラー:', error);
    }
  };

  const handleSave = async () => {
    try {
      const settings = {
        mttType: selectedMTT,
        corrections: corrections,
        config: mttConfig
      };

      localStorage.setItem('mttSettings', JSON.stringify(settings));
      alert('MTT設定を保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🚄 MTT機種設定</h1>
        <p>使用するMTT機種と補正設定を行います（PDF P23準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>MTT機種選択</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>MTT機種</label>
              <select
                value={selectedMTT}
                onChange={(e) => handleMTTChange(e.target.value)}
                className="form-select"
              >
                <option value="08-16">08-16（標準）</option>
                <option value="08-475">08-475</option>
                <option value="08-1X">08-1X</option>
                <option value="08-2X">08-2X</option>
                <option value="08-32幹">08-32幹</option>
                <option value="08-32幹2670">08-32幹2670</option>
                <option value="08-275">08-275</option>
                <option value="09-16在">09-16在</option>
                <option value="09-32">09-32</option>
                <option value="09-475">09-475</option>
              </select>
            </div>

            {mttConfig && (
              <div className="config-display">
                <h3>弦長設定</h3>
                <div className="config-grid">
                  <div>
                    <h4>レベリング</h4>
                    <p>BC間: <strong>{mttConfig.leveling?.bcLength}m</strong></p>
                    <p>CD間: <strong>{mttConfig.leveling?.cdLength}m</strong></p>
                  </div>
                  <div>
                    <h4>ライニング</h4>
                    <p>BC間: <strong>{mttConfig.lining?.bcLength}m</strong></p>
                    <p>CD間: <strong>{mttConfig.lining?.cdLength}m</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>移動量補正設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={corrections.levelingCorrection}
                  onChange={(e) => setCorrections({
                    ...corrections,
                    levelingCorrection: e.target.checked
                  })}
                />
                レベリング補正を適用
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={corrections.liningCorrection}
                  onChange={(e) => setCorrections({
                    ...corrections,
                    liningCorrection: e.target.checked
                  })}
                />
                ライニング補正を適用
              </label>
            </div>

            <div className="form-group">
              <label>補正率</label>
              <input
                type="number"
                value={corrections.correctionRate}
                onChange={(e) => setCorrections({
                  ...corrections,
                  correctionRate: Number(e.target.value)
                })}
                step="0.01"
                min="0.5"
                max="1.5"
              />
              <small>通常は1.0のまま使用してください</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>データ間隔設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>出力データ間隔</label>
              <select className="form-select">
                <option value="0.5">0.5m（高精度）</option>
                <option value="1">1m（標準）</option>
                <option value="5">5m（ALS/ALC用）</option>
              </select>
            </div>

            <div className="info-box">
              <p>📌 <strong>注意事項:</strong></p>
              <ul>
                <li>ALS/ALC出力時は5m間隔を推奨</li>
                <li>MJ作業データは0.5m間隔固定</li>
                <li>汎用データは1m間隔固定</li>
              </ul>
            </div>
          </div>
        </div>

        {/* MTT誘導補正パネル（新機能） */}
        <div className="card">
          <div className="card-header">
            <h2>🎯 MTT誘導補正システム</h2>
          </div>
          <div className="card-body">
            <div className="info-box" style={{ marginBottom: '20px' }}>
              <p>MTT機械の誘導補正パラメータを詳細に設定し、フロント位置の最適化を行います。</p>
              <p>エネルギー最小化、ピーク最小化、RMS最小化の3つの手法から選択できます。</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowGuidancePanel(!showGuidancePanel)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: showGuidancePanel ? '#f44336' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
              >
                {showGuidancePanel ? '❌ MTT誘導パネルを閉じる' : '🚀 MTT誘導パネルを開く'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MTTGuidancePanelコンポーネント */}
      {showGuidancePanel && (
        <div style={{ margin: '20px auto', maxWidth: '1200px' }}>
          <MTTGuidancePanel
            onCorrectionsUpdate={(result) => {
              console.log('MTT誘導補正結果:', result);
              alert(`MTT補正完了: 作業効率 ${result.workEfficiency.toFixed(1)}%`);
            }}
          />
        </div>
      )}

      <div className="action-buttons">
        <PresetButtons.Save onClick={handleSave} />
      </div>
    </div>
  );
};