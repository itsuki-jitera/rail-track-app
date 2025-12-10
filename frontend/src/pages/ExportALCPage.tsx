/**
 * ALC出力ページ
 * PDF P36の仕様に基づく実装
 * ALC（Auto Lining & Cant）形式でデータ出力
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

export const ExportALCPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState({
    outputMode: 'lining-cant',
    fileEncoding: 'shift-jis',
    delimiter: 'comma',
    includeChecksum: true,
    outputPrecision: 'high',
    cantReference: 'left-rail'
  });

  const exportALC = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/export-alc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alc_export_${Date.now()}.alc`;
        a.click();
        URL.revokeObjectURL(url);
        alert('ALC形式で出力しました');
      }
    } catch (error) {
      console.error('出力エラー:', error);
      alert('ALC出力に失敗しました');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📤 ALC出力</h1>
        <p>Auto Lining & Cant形式でデータを出力します（PDF P36準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>出力設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>出力モード</label>
              <select
                value={settings.outputMode}
                onChange={(e) => setSettings({
                  ...settings,
                  outputMode: e.target.value
                })}
              >
                <option value="lining-cant">通り・カント同時</option>
                <option value="lining-only">通りのみ</option>
                <option value="cant-only">カントのみ</option>
              </select>
            </div>

            <div className="form-group">
              <label>カント基準</label>
              <select
                value={settings.cantReference}
                onChange={(e) => setSettings({
                  ...settings,
                  cantReference: e.target.value
                })}
              >
                <option value="left-rail">左レール基準</option>
                <option value="right-rail">右レール基準</option>
                <option value="center-line">中心線基準</option>
              </select>
            </div>

            <div className="form-group">
              <label>精度モード</label>
              <select
                value={settings.outputPrecision}
                onChange={(e) => setSettings({
                  ...settings,
                  outputPrecision: e.target.value
                })}
              >
                <option value="high">高精度 (0.1mm)</option>
                <option value="standard">標準 (1mm)</option>
                <option value="low">低精度 (10mm)</option>
              </select>
            </div>

            <div className="form-group">
              <label>ファイルエンコーディング</label>
              <select
                value={settings.fileEncoding}
                onChange={(e) => setSettings({
                  ...settings,
                  fileEncoding: e.target.value
                })}
              >
                <option value="shift-jis">Shift-JIS (日本語対応)</option>
                <option value="utf-8">UTF-8</option>
                <option value="ascii">ASCII</option>
              </select>
            </div>

            <div className="form-group">
              <label>区切り文字</label>
              <select
                value={settings.delimiter}
                onChange={(e) => setSettings({
                  ...settings,
                  delimiter: e.target.value
                })}
              >
                <option value="comma">カンマ (,)</option>
                <option value="tab">タブ</option>
                <option value="space">スペース</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeChecksum}
                  onChange={(e) => setSettings({
                    ...settings,
                    includeChecksum: e.target.checked
                  })}
                />
                チェックサムを含める（データ整合性検証用）
              </label>
            </div>

            <div className="action-buttons">
              <PresetButtons.Export
                label="ALC形式で出力"
                onClick={exportALC}
                loading={exporting}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>ALC形式について</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📋 ALC形式の特徴</h3>
              <ul>
                <li>通り（Alignment）とカント（Cant）の同時制御</li>
                <li>曲線部の高精度整正に最適</li>
                <li>カント基準点の設定が可能</li>
                <li>チェックサムによるデータ整合性保証</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>📄 ファイル構造例</h3>
              <pre style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto'
              }}>
{`# ALC DATA FILE
# MODE: LINING-CANT
# REFERENCE: LEFT-RAIL
# PRECISION: HIGH

DIST,LINING,CANT
0.0,0.0,105.0
0.25,0.5,105.2
0.50,1.2,105.5
0.75,1.8,105.8
...

# CHECKSUM: A5F3B2C1`}
              </pre>
            </div>

            <div className="warning-box">
              <h3>⚠️ 出力時の注意</h3>
              <ul>
                <li>カント基準は現場の整正方針に合わせて設定</li>
                <li>曲線部では通りとカントの同時出力を推奨</li>
                <li>チェックサムを必ず有効化（データ破損検出）</li>
                <li>出力後はプレビュー確認を実施</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>適用場面と活用</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>🎯 最適な使用場面</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>曲線部整正</td>
                    <td>通りとカントの同時制御で高精度実現</td>
                  </tr>
                  <tr>
                    <td>緩和曲線</td>
                    <td>カント逓減の精密制御</td>
                  </tr>
                  <tr>
                    <td>複心曲線</td>
                    <td>複雑な曲線形状の再現</td>
                  </tr>
                  <tr>
                    <td>高速線区</td>
                    <td>乗り心地向上のための精密整正</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="info-box">
              <h3>💡 精度モードの選択指針</h3>
              <ul>
                <li><strong>高精度:</strong> 高速線区、重要区間</li>
                <li><strong>標準:</strong> 一般的な線区</li>
                <li><strong>低精度:</strong> 入換線、側線等</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>🔍 カント基準の選択</h3>
              <ul>
                <li><strong>左レール基準:</strong> 標準、多くの現場で使用</li>
                <li><strong>右レール基準:</strong> 特殊な整正方針</li>
                <li><strong>中心線基準:</strong> 新幹線等の高速線</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
