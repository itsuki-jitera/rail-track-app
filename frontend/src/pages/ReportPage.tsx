/**
 * 成果表作成ページ
 * PDF P38-40の仕様に基づく実装
 * 軌道整正作業の成果表を自動生成
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

interface ReportSection {
  id: string;
  title: string;
  enabled: boolean;
}

export const ReportPage: React.FC = () => {
  const [generating, setGenerating] = useState(false);
  const [reportSettings, setReportSettings] = useState({
    projectName: '',
    workDate: '',
    contractor: '',
    section: '',
    reportType: 'comprehensive',
    outputFormat: 'pdf',
    includeGraphs: true,
    includePhotos: false,
    includeRawData: false
  });

  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'cover', title: '表紙', enabled: true },
    { id: 'summary', title: '作業概要', enabled: true },
    { id: 'before-after', title: '整正前後比較', enabled: true },
    { id: 'quality', title: '品質評価（σ値・良化率）', enabled: true },
    { id: 'movement', title: '移動量一覧', enabled: true },
    { id: 'graphs', title: 'グラフ・図表', enabled: true },
    { id: 'section-detail', title: '区間別詳細', enabled: false },
    { id: 'inspection', title: '検査記録', enabled: false },
    { id: 'appendix', title: '付録・参考資料', enabled: false }
  ]);

  const generateReport = async () => {
    if (!reportSettings.projectName || !reportSettings.workDate) {
      alert('プロジェクト名と作業日は必須です');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: reportSettings,
          sections: sections.filter(s => s.enabled)
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = reportSettings.outputFormat === 'pdf' ? 'pdf' :
                    reportSettings.outputFormat === 'word' ? 'docx' : 'xlsx';
        a.download = `report_${reportSettings.projectName}_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        alert('成果表を生成しました');
      }
    } catch (error) {
      console.error('生成エラー:', error);
      alert('成果表の生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSection = (id: string) => {
    setSections(sections.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📋 成果表作成</h1>
        <p>軌道整正作業の成果表を自動生成します（PDF P38-40準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>基本情報</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>プロジェクト名 *</label>
              <input
                type="text"
                value={reportSettings.projectName}
                onChange={(e) => setReportSettings({
                  ...reportSettings,
                  projectName: e.target.value
                })}
                placeholder="例: 〇〇線 △△駅付近軌道整正工事"
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>作業日 *</label>
                <input
                  type="date"
                  value={reportSettings.workDate}
                  onChange={(e) => setReportSettings({
                    ...reportSettings,
                    workDate: e.target.value
                  })}
                />
              </div>

              <div className="form-group">
                <label>施工業者</label>
                <input
                  type="text"
                  value={reportSettings.contractor}
                  onChange={(e) => setReportSettings({
                    ...reportSettings,
                    contractor: e.target.value
                  })}
                  placeholder="例: 株式会社〇〇工務店"
                />
              </div>
            </div>

            <div className="form-group">
              <label>対象区間</label>
              <input
                type="text"
                value={reportSettings.section}
                onChange={(e) => setReportSettings({
                  ...reportSettings,
                  section: e.target.value
                })}
                placeholder="例: K1234+0 ～ K5678+0"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>出力設定</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>成果表タイプ</label>
              <select
                value={reportSettings.reportType}
                onChange={(e) => setReportSettings({
                  ...reportSettings,
                  reportType: e.target.value
                })}
              >
                <option value="comprehensive">総合成果表（全項目）</option>
                <option value="summary">概要版</option>
                <option value="quality">品質評価版</option>
                <option value="simple">簡易版</option>
              </select>
            </div>

            <div className="form-group">
              <label>出力形式</label>
              <select
                value={reportSettings.outputFormat}
                onChange={(e) => setReportSettings({
                  ...reportSettings,
                  outputFormat: e.target.value
                })}
              >
                <option value="pdf">PDF（推奨）</option>
                <option value="word">Word文書（編集可能）</option>
                <option value="excel">Excel（データ重視）</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={reportSettings.includeGraphs}
                  onChange={(e) => setReportSettings({
                    ...reportSettings,
                    includeGraphs: e.target.checked
                  })}
                />
                グラフ・図表を含める
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={reportSettings.includePhotos}
                  onChange={(e) => setReportSettings({
                    ...reportSettings,
                    includePhotos: e.target.checked
                  })}
                />
                現場写真を含める
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={reportSettings.includeRawData}
                  onChange={(e) => setReportSettings({
                    ...reportSettings,
                    includeRawData: e.target.checked
                  })}
                />
                生データを付録として添付
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>掲載セクション</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📑 成果表の構成</h3>
              {sections.map(section => (
                <div key={section.id} className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={() => toggleSection(section.id)}
                    />
                    {section.title}
                  </label>
                </div>
              ))}
            </div>

            <div className="action-buttons">
              <PresetButtons.Execute
                label="成果表を生成"
                onClick={generateReport}
                loading={generating}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>成果表について</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📊 標準的な成果表の構成</h3>
              <ol style={{ paddingLeft: '20px' }}>
                <li>表紙（プロジェクト名、日付、施工者）</li>
                <li>作業概要（目的、範囲、工法）</li>
                <li>整正前後比較（グラフ、数値表）</li>
                <li>品質評価（σ値、良化率、等級判定）</li>
                <li>移動量一覧（区間別実績）</li>
                <li>グラフ・図表（可視化データ）</li>
                <li>検査記録（検測結果）</li>
                <li>付録（生データ、参考資料）</li>
              </ol>
            </div>

            <div className="info-box">
              <h3>🎯 成果表の用途</h3>
              <ul>
                <li>発注者への報告書</li>
                <li>品質管理記録</li>
                <li>社内承認資料</li>
                <li>技術資料としてのアーカイブ</li>
                <li>次回工事の参考資料</li>
              </ul>
            </div>

            <div className="warning-box">
              <h3>⚠️ 作成時の注意</h3>
              <ul>
                <li>プロジェクト名と日付は必須項目</li>
                <li>データの最終確認を実施してから生成</li>
                <li>グラフは見やすさを重視</li>
                <li>異常値や特記事項は必ずコメント</li>
                <li>生成後は内容の最終チェックを実施</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>💡 効果的な成果表作成のコツ</h3>
              <ul>
                <li>見出しと項目番号を明確に</li>
                <li>グラフと表を効果的に組み合わせ</li>
                <li>重要な数値は強調表示</li>
                <li>写真には説明キャプションを付与</li>
                <li>要約・結論は冒頭に配置</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <StandardButton
          label="プレビュー"
          type="secondary"
          onClick={() => alert('プレビュー機能は開発中です')}
        />
        <PresetButtons.Save
          label="設定を保存"
          onClick={() => {
            localStorage.setItem('reportSettings', JSON.stringify(reportSettings));
            alert('設定を保存しました');
          }}
        />
      </div>
    </div>
  );
};
