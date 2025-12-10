/**
 * ALS出力ページ
 * PDF P32-33の仕様に基づく実装
 * ALS（Auto Leveling System）形式でデータ出力
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

export const ExportALSPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState({
    outputType: 'standard',
    includeHeader: true,
    includeMetadata: true,
    decimalPlaces: 2,
    distanceUnit: 'm',
    dataType: 'height',
    coordinateSystem: 'relative'
  });

  const exportALS = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/export-als', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `als_export_${Date.now()}.als`;
        a.click();
        URL.revokeObjectURL(url);
        alert('ALS形式で出力しました');
      }
    } catch (error) {
      console.error('出力エラー:', error);
      alert('ALS出力に失敗しました');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📤 ALS出力</h1>
        <p>Auto Leveling System形式でデータを出力します（PDF P32-33準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>出力設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>出力タイプ</label>
              <select
                value={settings.outputType}
                onChange={(e) => setSettings({
                  ...settings,
                  outputType: e.target.value
                })}
              >
                <option value="standard">標準ALS形式</option>
                <option value="extended">拡張ALS形式</option>
                <option value="compact">簡易ALS形式</option>
              </select>
            </div>

            <div className="form-group">
              <label>データ種別</label>
              <select
                value={settings.dataType}
                onChange={(e) => setSettings({
                  ...settings,
                  dataType: e.target.value
                })}
              >
                <option value="height">高低</option>
                <option value="alignment">通り</option>
                <option value="cant">カント</option>
                <option value="gauge">軌間</option>
                <option value="all">全データ</option>
              </select>
            </div>

            <div className="form-group">
              <label>座標系</label>
              <select
                value={settings.coordinateSystem}
                onChange={(e) => setSettings({
                  ...settings,
                  coordinateSystem: e.target.value
                })}
              >
                <option value="relative">相対座標</option>
                <option value="absolute">絶対座標</option>
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>距離単位</label>
                <select
                  value={settings.distanceUnit}
                  onChange={(e) => setSettings({
                    ...settings,
                    distanceUnit: e.target.value
                  })}
                >
                  <option value="m">メートル (m)</option>
                  <option value="cm">センチメートル (cm)</option>
                  <option value="mm">ミリメートル (mm)</option>
                </select>
              </div>

              <div className="form-group">
                <label>小数点以下桁数</label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  value={settings.decimalPlaces}
                  onChange={(e) => setSettings({
                    ...settings,
                    decimalPlaces: Number(e.target.value)
                  })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeHeader}
                  onChange={(e) => setSettings({
                    ...settings,
                    includeHeader: e.target.checked
                  })}
                />
                ヘッダー情報を含める
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.includeMetadata}
                  onChange={(e) => setSettings({
                    ...settings,
                    includeMetadata: e.target.checked
                  })}
                />
                メタデータを含める
              </label>
            </div>

            <div className="action-buttons">
              <PresetButtons.Export
                label="ALS形式で出力"
                onClick={exportALS}
                loading={exporting}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>ALS形式について</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📋 ALS形式の特徴</h3>
              <ul>
                <li>マルチプルタイタンパー用の標準データ形式</li>
                <li>高低・通り・カント・軌間データに対応</li>
                <li>相対座標・絶対座標の両方をサポート</li>
                <li>ヘッダー部にメタデータを格納</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>📄 ファイル構造</h3>
              <pre style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto'
              }}>
{`[HEADER]
VERSION=2.0
DATE=2025-12-09
SECTION=K1234-K5678
TYPE=HEIGHT

[DATA]
0.0,2.5
0.25,2.8
0.50,3.1
...`}
              </pre>
            </div>

            <div className="warning-box">
              <h3>⚠️ 出力時の注意</h3>
              <ul>
                <li>マルチプルタイタンパーの仕様に合わせた形式を選択</li>
                <li>座標系は現場の測量基準に合わせて設定</li>
                <li>小数点桁数は精度要求に応じて調整</li>
                <li>出力前にデータの妥当性を確認</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>出力データの活用</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>🚄 マルチプルタイタンパー連携</h3>
              <ul>
                <li>出力ファイルをUSBメモリ等で機械に転送</li>
                <li>自動整正モードで高精度な軌道整正を実現</li>
                <li>計画線通りの整正が可能</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>📊 データ検証</h3>
              <ul>
                <li>出力後は必ずデータ内容を確認</li>
                <li>距離程と測定値の対応をチェック</li>
                <li>異常値がないか確認</li>
                <li>必要に応じてバックアップを作成</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
