/**
 * 汎用出力ページ
 * PDF P37の仕様に基づく実装
 * 様々な形式での汎用データ出力
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

export const ExportGeneralPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState({
    format: 'csv',
    encoding: 'utf-8',
    delimiter: 'comma',
    includeHeader: true,
    includeMetadata: false,
    dateFormat: 'iso',
    numberFormat: 'decimal',
    outputItems: {
      distance: true,
      leftRail: true,
      rightRail: true,
      cant: true,
      gauge: false,
      timestamp: false,
      calculatedValues: false
    }
  });

  const exportGeneral = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/export-general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extensions: Record<string, string> = {
          'csv': 'csv',
          'excel': 'xlsx',
          'json': 'json',
          'xml': 'xml',
          'text': 'txt'
        };
        a.download = `general_export_${Date.now()}.${extensions[settings.format]}`;
        a.click();
        URL.revokeObjectURL(url);
        alert(`${settings.format.toUpperCase()}形式で出力しました`);
      }
    } catch (error) {
      console.error('出力エラー:', error);
      alert('汎用出力に失敗しました');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📤 汎用出力</h1>
        <p>様々な形式でデータを出力します（PDF P37準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>出力形式設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>ファイル形式</label>
              <select
                value={settings.format}
                onChange={(e) => setSettings({
                  ...settings,
                  format: e.target.value
                })}
              >
                <option value="csv">CSV（カンマ区切り）</option>
                <option value="excel">Excel（.xlsx）</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="text">テキスト</option>
              </select>
            </div>

            <div className="form-group">
              <label>文字エンコーディング</label>
              <select
                value={settings.encoding}
                onChange={(e) => setSettings({
                  ...settings,
                  encoding: e.target.value
                })}
              >
                <option value="utf-8">UTF-8（推奨）</option>
                <option value="shift-jis">Shift-JIS</option>
                <option value="euc-jp">EUC-JP</option>
                <option value="ascii">ASCII</option>
              </select>
            </div>

            {(settings.format === 'csv' || settings.format === 'text') && (
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
                  <option value="semicolon">セミコロン (;)</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label>日付形式</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => setSettings({
                  ...settings,
                  dateFormat: e.target.value
                })}
              >
                <option value="iso">ISO 8601 (2025-12-09T10:30:00)</option>
                <option value="japanese">日本形式 (2025年12月9日)</option>
                <option value="us">米国形式 (12/09/2025)</option>
                <option value="timestamp">UNIXタイムスタンプ</option>
              </select>
            </div>

            <div className="form-group">
              <label>数値形式</label>
              <select
                value={settings.numberFormat}
                onChange={(e) => setSettings({
                  ...settings,
                  numberFormat: e.target.value
                })}
              >
                <option value="decimal">小数点 (1234.56)</option>
                <option value="scientific">科学記法 (1.23e+3)</option>
                <option value="integer">整数化 (1235)</option>
              </select>
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
                ヘッダー行を含める
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
                メタデータを含める（作成日時、バージョン等）
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>出力項目選択</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📊 基本データ</h3>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.distance}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, distance: e.target.checked }
                    })}
                  />
                  距離程
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.leftRail}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, leftRail: e.target.checked }
                    })}
                  />
                  左レールデータ
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.rightRail}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, rightRail: e.target.checked }
                    })}
                  />
                  右レールデータ
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
                  軌間データ
                </label>
              </div>
            </div>

            <div className="info-box">
              <h3>📅 追加情報</h3>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.timestamp}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, timestamp: e.target.checked }
                    })}
                  />
                  測定日時
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.outputItems.calculatedValues}
                    onChange={(e) => setSettings({
                      ...settings,
                      outputItems: { ...settings.outputItems, calculatedValues: e.target.checked }
                    })}
                  />
                  計算値（σ値、移動量等）
                </label>
              </div>
            </div>

            <div className="action-buttons">
              <PresetButtons.Export
                label="データを出力"
                onClick={exportGeneral}
                loading={exporting}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>各形式の特徴</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📋 形式別の用途</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td><strong>CSV</strong></td>
                    <td>Excelや他システムでの読込に最適</td>
                  </tr>
                  <tr>
                    <td><strong>Excel</strong></td>
                    <td>グラフ作成、分析作業に便利</td>
                  </tr>
                  <tr>
                    <td><strong>JSON</strong></td>
                    <td>プログラム処理、API連携向け</td>
                  </tr>
                  <tr>
                    <td><strong>XML</strong></td>
                    <td>標準化されたデータ交換</td>
                  </tr>
                  <tr>
                    <td><strong>テキスト</strong></td>
                    <td>シンプルな記録、可読性重視</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="warning-box">
              <h3>⚠️ エンコーディングの注意</h3>
              <ul>
                <li>UTF-8: 最も汎用的、推奨</li>
                <li>Shift-JIS: 古いWindowsソフト用</li>
                <li>日本語を含む場合はUTF-8またはShift-JIS</li>
                <li>機械読込用はASCIIも選択可能</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>💡 活用シーン</h3>
              <ul>
                <li>データバックアップ</li>
                <li>他システムへのデータ移行</li>
                <li>報告書作成用のデータ抽出</li>
                <li>統計分析ソフトへの入力</li>
                <li>長期保存用のアーカイブ</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
