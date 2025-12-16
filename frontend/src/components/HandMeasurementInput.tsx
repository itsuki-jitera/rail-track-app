/**
 * 手検測データ入力コンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 軌間あるいは高低を1mごとに最大25mまで測定
 * - 複数区間測定すればより確実
 * - チャート上で特徴のある波形の区間を選び現地で手検測
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import './HandMeasurementInput.css';

interface HandMeasurementData {
  distance: number;  // 距離 (m)
  value: number;     // 測定値 (mm)
  type: 'gauge' | 'level' | 'alignment';  // 測定タイプ
}

interface MeasurementSection {
  id: string;
  name: string;
  startPosition: number;  // 開始位置 (m)
  data: HandMeasurementData[];
  measurementDate: Date;
  notes?: string;
}

interface CorrelationResult {
  offset: number;
  correlation: number;
  confidence: number;
}

interface HandMeasurementInputProps {
  onDataSubmit?: (sections: MeasurementSection[]) => void;
  onCorrelationRequest?: (section: MeasurementSection) => Promise<CorrelationResult>;
  maxLength?: number;  // 最大測定長 (デフォルト25m)
  interval?: number;   // 測定間隔 (デフォルト1m)
  existingData?: MeasurementSection[];
}

const HandMeasurementInput: React.FC<HandMeasurementInputProps> = ({
  onDataSubmit,
  onCorrelationRequest,
  maxLength = 25,
  interval = 1,
  existingData = []
}) => {
  const [sections, setSections] = useState<MeasurementSection[]>(existingData);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [measurementType, setMeasurementType] = useState<'gauge' | 'level' | 'alignment'>('level');
  const [correlationResults, setCorrelationResults] = useState<Map<string, CorrelationResult>>(new Map());

  // 新規セクションの追加
  const addNewSection = () => {
    const newSection: MeasurementSection = {
      id: `section-${Date.now()}`,
      name: `区間 ${sections.length + 1}`,
      startPosition: 0,
      data: Array.from({ length: maxLength / interval + 1 }, (_, i) => ({
        distance: i * interval,
        value: 0,
        type: measurementType
      })),
      measurementDate: new Date()
    };

    setSections([...sections, newSection]);
    setActiveSection(newSection.id);
  };

  // セクションの削除
  const deleteSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
    if (activeSection === sectionId) {
      setActiveSection(null);
    }
    correlationResults.delete(sectionId);
    setCorrelationResults(new Map(correlationResults));
  };

  // 測定値の更新
  const updateMeasurement = (sectionId: string, index: number, value: number) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        const newData = [...section.data];
        newData[index] = { ...newData[index], value };
        return { ...section, data: newData };
      }
      return section;
    }));
  };

  // セクション情報の更新
  const updateSectionInfo = (sectionId: string, field: string, value: any) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, [field]: value };
      }
      return section;
    }));
  };

  // 相関計算の実行
  const performCorrelation = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || !onCorrelationRequest) return;

    try {
      const result = await onCorrelationRequest(section);
      correlationResults.set(sectionId, result);
      setCorrelationResults(new Map(correlationResults));
    } catch (error) {
      console.error('相関計算エラー:', error);
    }
  };

  // データの保存
  const handleSave = () => {
    if (onDataSubmit) {
      onDataSubmit(sections);
    }
  };

  // CSV形式でのインポート
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const data: HandMeasurementData[] = [];

      lines.forEach((line, index) => {
        if (index === 0 || !line.trim()) return; // ヘッダーまたは空行をスキップ
        const [distance, value] = line.split(',').map(v => parseFloat(v.trim()));
        if (!isNaN(distance) && !isNaN(value)) {
          data.push({
            distance,
            value,
            type: measurementType
          });
        }
      });

      if (data.length > 0) {
        const newSection: MeasurementSection = {
          id: `section-${Date.now()}`,
          name: `インポート区間 ${sections.length + 1}`,
          startPosition: 0,
          data,
          measurementDate: new Date()
        };
        setSections([...sections, newSection]);
      }
    };
    reader.readAsText(file);
  };

  // アクティブセクションの取得
  const getActiveSection = () => sections.find(s => s.id === activeSection);

  // チャートデータの生成
  const generateChartData = (section: MeasurementSection) => {
    const labels = section.data.map(d => d.distance.toFixed(1));
    const data = section.data.map(d => d.value);

    return {
      labels,
      datasets: [{
        label: `${section.name} - ${measurementType === 'level' ? '高低' : measurementType === 'gauge' ? '軌間' : '通り'}`,
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(75, 192, 192)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '手検測データ'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y.toFixed(2)} mm`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '距離 (m)'
        }
      },
      y: {
        title: {
          display: true,
          text: '測定値 (mm)'
        }
      }
    }
  };

  return (
    <div className="hand-measurement-input">
      {/* ツールバー */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-primary" onClick={addNewSection}>
            ➕ 新規区間追加
          </button>
          <select
            value={measurementType}
            onChange={(e) => setMeasurementType(e.target.value as any)}
            className="measurement-type-selector"
          >
            <option value="level">高低</option>
            <option value="gauge">軌間</option>
            <option value="alignment">通り</option>
          </select>
          <label className="import-csv">
            📁 CSVインポート
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div className="toolbar-right">
          <button
            className="btn btn-success"
            onClick={handleSave}
            disabled={sections.length === 0}
          >
            💾 保存
          </button>
        </div>
      </div>

      <div className="main-content">
        {/* セクションリスト */}
        <div className="sections-panel">
          <h3>測定区間</h3>
          <div className="sections-list">
            {sections.map(section => (
              <div
                key={section.id}
                className={`section-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <div className="section-header">
                  <input
                    type="text"
                    value={section.name}
                    onChange={(e) => updateSectionInfo(section.id, 'name', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="section-name-input"
                  />
                  <button
                    className="btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSection(section.id);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="section-info">
                  <span>開始: {section.startPosition}m</span>
                  <span>点数: {section.data.length}</span>
                </div>
                {correlationResults.has(section.id) && (
                  <div className="correlation-info">
                    <span className="correlation-badge">
                      相関: {correlationResults.get(section.id)!.correlation.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* データ入力エリア */}
        <div className="data-input-panel">
          {activeSection && getActiveSection() ? (
            <>
              <div className="section-details">
                <h3>{getActiveSection()!.name}</h3>
                <div className="section-controls">
                  <label>
                    開始位置 (m):
                    <input
                      type="number"
                      value={getActiveSection()!.startPosition}
                      onChange={(e) => updateSectionInfo(activeSection, 'startPosition', parseFloat(e.target.value))}
                      className="position-input"
                    />
                  </label>
                  <label>
                    備考:
                    <textarea
                      value={getActiveSection()!.notes || ''}
                      onChange={(e) => updateSectionInfo(activeSection, 'notes', e.target.value)}
                      className="notes-input"
                      placeholder="測定時の状況など"
                    />
                  </label>
                </div>
              </div>

              {/* データ入力テーブル */}
              <div className="data-table-container">
                <table className="data-input-table">
                  <thead>
                    <tr>
                      <th>距離 (m)</th>
                      <th>測定値 (mm)</th>
                      <th>クイック入力</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getActiveSection()!.data.map((item, index) => (
                      <tr key={index}>
                        <td>{item.distance.toFixed(1)}</td>
                        <td>
                          <input
                            type="number"
                            value={item.value}
                            onChange={(e) => updateMeasurement(activeSection, index, parseFloat(e.target.value) || 0)}
                            step="0.1"
                            className="value-input"
                          />
                        </td>
                        <td className="quick-buttons">
                          <button onClick={() => updateMeasurement(activeSection, index, item.value + 1)}>+1</button>
                          <button onClick={() => updateMeasurement(activeSection, index, item.value + 0.1)}>+0.1</button>
                          <button onClick={() => updateMeasurement(activeSection, index, item.value - 0.1)}>-0.1</button>
                          <button onClick={() => updateMeasurement(activeSection, index, item.value - 1)}>-1</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* グラフ表示 */}
              <div className="chart-container" style={{ height: '300px', marginTop: '20px' }}>
                <Line data={generateChartData(getActiveSection()!)} options={chartOptions} />
              </div>

              {/* 相関計算ボタン */}
              {onCorrelationRequest && (
                <div className="correlation-controls">
                  <button
                    className="btn btn-info"
                    onClick={() => performCorrelation(activeSection)}
                  >
                    🔍 相関計算実行
                  </button>
                  {correlationResults.has(activeSection) && (
                    <div className="correlation-result">
                      <p>オフセット: {correlationResults.get(activeSection)!.offset.toFixed(2)}m</p>
                      <p>相関係数: {correlationResults.get(activeSection)!.correlation.toFixed(4)}</p>
                      <p>信頼度: {correlationResults.get(activeSection)!.confidence.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <p>左側から測定区間を選択するか、新規区間を追加してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HandMeasurementInput;