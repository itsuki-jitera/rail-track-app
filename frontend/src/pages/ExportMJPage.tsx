/**
 * MJ出力ページ
 * PDF P34-35の仕様に基づく実装
 * MJ（MultipleJet）形式でデータ出力
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

export const ExportMJPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState({
    machineType: 'MJ09',
    dataFormat: 'binary',
    includeTimestamp: true,
    compressionLevel: 'standard',
    leftRightSeparate: true,
    outputItems: {
      height: true,
      alignment: true,
      cant: true,
      gauge: false
    }
  });

  const exportMJ = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/export-mj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = settings.dataFormat === 'binary' ? 'mjb' : 'mjt';
        a.download = `mj_export_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        alert('MJ形式で出力しました');
      }
    } catch (error) {
      console.error('出力エラー:', error);
      alert('MJ出力に失敗しました');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📤 MJ出力</h1>
        <p>MultipleJet（プラッサー社）形式でデータを出力します（PDF P34-35準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>出力設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>機械タイプ</label>
              <select
                value={settings.machineType}
                onChange={(e) => setSettings({
                  ...settings,
                  machineType: e.target.value
                })}
              >
                <option value="MJ09">MJ09 (09-3X/4X)</option>
                <option value="MJ08">MJ08 (08-4X/32)</option>
                <option value="MJ07">MJ07 (07-4X/32)</option>
                <option value="UNIMAT">UNIMAT 09-4X</option>
              </select>
            </div>

            <div className="form-group">
              <label>データ形式</label>
              <select
                value={settings.dataFormat}
                onChange={(e) => setSettings({
                  ...settings,
                  dataFormat: e.target.value
                })}
              >
                <option value="binary">バイナリ形式 (.mjb)</option>
                <option value="text">テキスト形式 (.mjt)</option>
              </select>
              <small>バイナリ形式推奨（ファイルサイズ小・高速）</small>
            </div>

            <div className="form-group">
              <label>圧縮レベル</label>
              <select
                value={settings.compressionLevel}
                onChange={(e) => setSettings({
                  ...settings,
                  compressionLevel: e.target.value
                })}
              >
                <option value="none">圧縮なし</option>
                <option value="standard">標準圧縮</option>
                <option value="high">高圧縮</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.leftRightSeparate}
                  onChange={(e) => setSettings({
                    ...settings,
                    leftRightSeparate: e.target.checked
                  })}
                />
                左右レール別出力
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeTimestamp}
                  onChange={(e) => setSettings({
                    ...settings,
                    includeTimestamp: e.target.checked
                  })}
                />
                タイムスタンプを含める
              </label>
            </div>

            <div className="info-box">
              <h3>📊 出力項目</h3>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.height}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, height: e.target.checked }
                    })}
                  />
                  高低データ
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.alignment}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, alignment: e.target.checked }
                    })}
                  />
                  通りデータ
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.cant}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, cant: e.target.checked }
                    })}
                  />
                  カントデータ
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.gauge}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, gauge: e.target.checked }
                    })}
                  />
                  軌間データ（対応機種のみ）
                </label>
              </div>
            </div>

            <div className="action-buttons">
              <PresetButtons.Export
                label="MJ形式で出力"
                onClick={exportMJ}
                loading={exporting}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>MJ形式について</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>🚄 プラッサー社マルチプルタイタンパー</h3>
              <ul>
                <li>世界標準のマルチプルタイタンパー製造メーカー</li>
                <li>MJ形式は独自のデータフォーマット</li>
                <li>バイナリ形式で高速・省容量</li>
                <li>左右レール個別の精密制御が可能</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>📋 対応機種</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>MJ09 (09-3X/4X)</td>
                    <td>最新型、全データ対応</td>
                  </tr>
                  <tr>
                    <td>MJ08 (08-4X/32)</td>
                    <td>高低・通り・カント</td>
                  </tr>
                  <tr>
                    <td>MJ07 (07-4X/32)</td>
                    <td>高低・通り</td>
                  </tr>
                  <tr>
                    <td>UNIMAT 09-4X</td>
                    <td>全データ対応</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="warning-box">
              <h3>⚠️ 重要な注意事項</h3>
              <ul>
                <li>機械タイプは現場の実機に合わせて選択</li>
                <li>バイナリ形式は破損に注意（バックアップ必須）</li>
                <li>左右レール別出力は機械の仕様を確認</li>
                <li>出力後は必ず動作確認を実施</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>データ転送手順</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📝 標準手順</h3>
              <ol style={{ paddingLeft: '20px' }}>
                <li>PCで本システムからMJファイルを出力</li>
                <li>USBメモリにファイルをコピー</li>
                <li>マルチプルタイタンパーにUSBメモリを接続</li>
                <li>機械の操作パネルからファイルを読込</li>
                <li>データ内容を確認</li>
                <li>自動整正モードで作業開始</li>
              </ol>
            </div>

            <div className="info-box">
              <h3>✅ 転送前チェック項目</h3>
              <ul>
                <li>ファイル名に日本語や特殊文字を使用していないか</li>
                <li>USBメモリがFAT32形式でフォーマットされているか</li>
                <li>データの距離程が作業区間と一致しているか</li>
                <li>バックアップファイルを作成したか</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
