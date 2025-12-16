/**
 * 作業区間表示コンポーネント
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 作業区間の開始・終了位置を縦線で表示
 * - 50m〜150mの範囲表示に対応
 * - ビューポート制御機能
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import './WorkSectionDisplay.css';

interface DataPoint {
  position: number;
  value: number;
}

interface WorkSection {
  id: string;
  startPosition: number;  // 開始位置 (m)
  endPosition: number;    // 終了位置 (m)
  name?: string;          // 区間名
  type?: 'normal' | 'wb'; // 通常区間/WB区間
}

interface WorkSectionDisplayProps {
  restoredWaveform: DataPoint[];
  planLine?: DataPoint[];
  workSections: WorkSection[];
  currentSectionId?: string;
  viewportRange?: number;      // 表示範囲 (50-150m)
  showSectionLines?: boolean;  // 区間線表示
  showViewportControls?: boolean;
  onSectionChange?: (sectionId: string) => void;
  onViewportChange?: (start: number, end: number) => void;
}

const WorkSectionDisplay: React.FC<WorkSectionDisplayProps> = ({
  restoredWaveform,
  planLine,
  workSections,
  currentSectionId,
  viewportRange = 100,
  showSectionLines = true,
  showViewportControls = true,
  onSectionChange,
  onViewportChange
}) => {
  const [viewportStart, setViewportStart] = useState(0);
  const [viewportEnd, setViewportEnd] = useState(viewportRange);
  const [zoomLevel, setZoomLevel] = useState(1);

  // 現在の作業区間
  const currentSection = useMemo(() => {
    return workSections.find(s => s.id === currentSectionId);
  }, [workSections, currentSectionId]);

  // ビューポート内のデータ
  const viewportData = useMemo(() => {
    const filterInViewport = (data: DataPoint[]) => {
      return data.filter(d =>
        d.position >= viewportStart && d.position <= viewportEnd
      );
    };

    return {
      waveform: filterInViewport(restoredWaveform),
      planLine: planLine ? filterInViewport(planLine) : []
    };
  }, [restoredWaveform, planLine, viewportStart, viewportEnd]);

  // ビューポートの移動
  const moveViewport = useCallback((direction: 'left' | 'right', amount?: number) => {
    const moveAmount = amount || viewportRange * 0.1;

    if (direction === 'left') {
      const newStart = Math.max(0, viewportStart - moveAmount);
      const newEnd = newStart + viewportRange;
      setViewportStart(newStart);
      setViewportEnd(newEnd);

      if (onViewportChange) {
        onViewportChange(newStart, newEnd);
      }
    } else {
      const maxPosition = Math.max(...restoredWaveform.map(d => d.position));
      const newStart = Math.min(maxPosition - viewportRange, viewportStart + moveAmount);
      const newEnd = newStart + viewportRange;
      setViewportStart(newStart);
      setViewportEnd(newEnd);

      if (onViewportChange) {
        onViewportChange(newStart, newEnd);
      }
    }
  }, [viewportStart, viewportRange, restoredWaveform, onViewportChange]);

  // ビューポートのズーム
  const zoomViewport = useCallback((factor: number) => {
    const center = (viewportStart + viewportEnd) / 2;
    const newRange = Math.max(50, Math.min(150, viewportRange * factor));
    const newStart = Math.max(0, center - newRange / 2);
    const newEnd = newStart + newRange;

    setViewportStart(newStart);
    setViewportEnd(newEnd);
    setZoomLevel(zoomLevel * factor);

    if (onViewportChange) {
      onViewportChange(newStart, newEnd);
    }
  }, [viewportStart, viewportEnd, viewportRange, zoomLevel, onViewportChange]);

  // 作業区間へジャンプ
  const jumpToSection = useCallback((sectionId: string) => {
    const section = workSections.find(s => s.id === sectionId);
    if (!section) return;

    const sectionLength = section.endPosition - section.startPosition;
    const padding = Math.min(20, sectionLength * 0.1);

    const newStart = Math.max(0, section.startPosition - padding);
    const newEnd = Math.min(
      Math.max(...restoredWaveform.map(d => d.position)),
      section.endPosition + padding
    );

    setViewportStart(newStart);
    setViewportEnd(newEnd);

    if (onSectionChange) {
      onSectionChange(sectionId);
    }

    if (onViewportChange) {
      onViewportChange(newStart, newEnd);
    }
  }, [workSections, restoredWaveform, onSectionChange, onViewportChange]);

  // チャートデータの生成
  const generateChartData = () => {
    const datasets = [];

    // 復元波形
    datasets.push({
      label: '復元波形',
      data: viewportData.waveform.map(d => ({ x: d.position, y: d.value })),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    });

    // 計画線
    if (viewportData.planLine.length > 0) {
      datasets.push({
        label: '計画線',
        data: viewportData.planLine.map(d => ({ x: d.position, y: d.value })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
      });
    }

    return { datasets };
  };

  // チャートオプション
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: currentSection ?
          `作業区間: ${currentSection.name || currentSection.id}` :
          '作業区間表示'
      },
      annotation: showSectionLines ? {
        annotations: workSections.reduce((acc: any, section) => {
          // 区間開始線
          if (section.startPosition >= viewportStart && section.startPosition <= viewportEnd) {
            acc[`start-${section.id}`] = {
              type: 'line',
              xMin: section.startPosition,
              xMax: section.startPosition,
              borderColor: section.type === 'wb' ? 'rgb(255, 206, 86)' : 'rgb(54, 162, 235)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                enabled: true,
                content: `開始: ${section.name || section.id}`,
                position: 'start',
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                color: 'white',
                font: {
                  size: 11
                }
              }
            };
          }

          // 区間終了線
          if (section.endPosition >= viewportStart && section.endPosition <= viewportEnd) {
            acc[`end-${section.id}`] = {
              type: 'line',
              xMin: section.endPosition,
              xMax: section.endPosition,
              borderColor: section.type === 'wb' ? 'rgb(255, 206, 86)' : 'rgb(220, 53, 69)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                enabled: true,
                content: `終了: ${section.name || section.id}`,
                position: 'end',
                backgroundColor: 'rgba(220, 53, 69, 0.8)',
                color: 'white',
                font: {
                  size: 11
                }
              }
            };
          }

          // 現在の区間をハイライト
          if (section.id === currentSectionId) {
            const highlightStart = Math.max(section.startPosition, viewportStart);
            const highlightEnd = Math.min(section.endPosition, viewportEnd);

            if (highlightStart < highlightEnd) {
              acc[`highlight-${section.id}`] = {
                type: 'box',
                xMin: highlightStart,
                xMax: highlightEnd,
                yMin: -Infinity,
                yMax: Infinity,
                backgroundColor: 'rgba(54, 162, 235, 0.05)',
                borderWidth: 0
              };
            }
          }

          return acc;
        }, {})
      } : undefined
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: viewportStart,
        max: viewportEnd,
        title: {
          display: true,
          text: '位置 (m)'
        },
        ticks: {
          stepSize: viewportRange <= 50 ? 5 : viewportRange <= 100 ? 10 : 20
        }
      },
      y: {
        title: {
          display: true,
          text: '値 (mm)'
        }
      }
    }
  };

  return (
    <div className="work-section-display">
      {/* ビューポート制御 */}
      {showViewportControls && (
        <div className="viewport-controls">
          <div className="viewport-info">
            表示範囲: {viewportStart.toFixed(0)}m - {viewportEnd.toFixed(0)}m
            ({(viewportEnd - viewportStart).toFixed(0)}m)
          </div>

          <div className="viewport-buttons">
            <button
              onClick={() => moveViewport('left')}
              className="viewport-btn"
              disabled={viewportStart <= 0}
            >
              ← 左へ
            </button>

            <button
              onClick={() => zoomViewport(0.8)}
              className="viewport-btn"
            >
              拡大
            </button>

            <button
              onClick={() => zoomViewport(1.25)}
              className="viewport-btn"
            >
              縮小
            </button>

            <button
              onClick={() => moveViewport('right')}
              className="viewport-btn"
              disabled={viewportEnd >= Math.max(...restoredWaveform.map(d => d.position))}
            >
              右へ →
            </button>
          </div>

          {/* 範囲プリセット */}
          <div className="range-presets">
            <button
              onClick={() => {
                const newRange = 50;
                const newStart = viewportStart;
                const newEnd = newStart + newRange;
                setViewportEnd(newEnd);
              }}
              className={`preset-btn ${viewportEnd - viewportStart === 50 ? 'active' : ''}`}
            >
              50m
            </button>

            <button
              onClick={() => {
                const newRange = 100;
                const newStart = viewportStart;
                const newEnd = newStart + newRange;
                setViewportEnd(newEnd);
              }}
              className={`preset-btn ${viewportEnd - viewportStart === 100 ? 'active' : ''}`}
            >
              100m
            </button>

            <button
              onClick={() => {
                const newRange = 150;
                const newStart = viewportStart;
                const newEnd = newStart + newRange;
                setViewportEnd(newEnd);
              }}
              className={`preset-btn ${viewportEnd - viewportStart === 150 ? 'active' : ''}`}
            >
              150m
            </button>
          </div>
        </div>
      )}

      {/* 作業区間セレクター */}
      <div className="section-selector">
        <label>作業区間:</label>
        <select
          value={currentSectionId || ''}
          onChange={(e) => jumpToSection(e.target.value)}
        >
          <option value="">選択してください</option>
          {workSections.map(section => (
            <option key={section.id} value={section.id}>
              {section.name || section.id}
              {section.type === 'wb' ? ' (WB)' : ''}
              ({section.startPosition}m - {section.endPosition}m)
            </option>
          ))}
        </select>
      </div>

      {/* チャート */}
      <div className="chart-container" style={{ height: '500px' }}>
        <Line data={generateChartData()} options={chartOptions} />
      </div>

      {/* 区間情報 */}
      {currentSection && (
        <div className="section-info">
          <h4>現在の作業区間情報</h4>
          <p>区間名: {currentSection.name || currentSection.id}</p>
          <p>開始位置: {currentSection.startPosition}m</p>
          <p>終了位置: {currentSection.endPosition}m</p>
          <p>区間長: {currentSection.endPosition - currentSection.startPosition}m</p>
          <p>種別: {currentSection.type === 'wb' ? 'WB区間' : '通常区間'}</p>
        </div>
      )}
    </div>
  );
};

export default WorkSectionDisplay;