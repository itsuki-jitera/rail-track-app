/**
 * 位置合わせ処理コンポーネント
 * 水準狂い（レベル）とカントデータを重ね合わせて位置を正確に合わせる
 */

import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PositionAlignmentProps {
  levelData?: number[];
  cantData?: number[];
  positions?: number[];
  onAlignmentComplete?: (offset: number) => void;
}

export const PositionAlignment: React.FC<PositionAlignmentProps> = ({
  levelData: propLevelData,
  cantData: propCantData,
  positions: propPositions,
  onAlignmentComplete
}) => {
  const { state, dispatch } = useGlobalWorkspace();

  // データ取得（プロパティまたはグローバル状態から）
  const levelData = propLevelData || state.originalData.kiyaData?.level || [];
  const cantData = propCantData || state.originalData.kiyaData?.cant || [];
  const positions = propPositions || state.originalData.kiyaData?.positions || [];

  const [offset, setOffset] = useState(0); // 位置オフセット（m）
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [correlationScore, setCorrelationScore] = useState(0);
  const [bestOffset, setBestOffset] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState(0);

  const chartRef = useRef<ChartJS<"line", number[], string>>(null);

  // 相関計算
  const calculateCorrelation = (offset: number): number => {
    if (levelData.length === 0 || cantData.length === 0) return 0;

    const shiftedIndex = Math.floor(offset / 0.25); // 0.25m間隔を想定
    let sum = 0;
    let count = 0;

    for (let i = 0; i < Math.min(levelData.length, cantData.length); i++) {
      const levelIndex = i;
      const cantIndex = i + shiftedIndex;

      if (cantIndex >= 0 && cantIndex < cantData.length) {
        // 正規化して相関を計算
        const levelNorm = levelData[levelIndex] / (Math.abs(levelData[levelIndex]) + 1);
        const cantNorm = cantData[cantIndex] / (Math.abs(cantData[cantIndex]) + 1);
        sum += levelNorm * cantNorm;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  };

  // 自動位置合わせ
  const autoAlign = async () => {
    console.log('自動位置合わせ開始');
    console.log('levelData:', levelData?.length || 0, 'points');
    console.log('cantData:', cantData?.length || 0, 'points');
    console.log('positions:', positions?.length || 0, 'points');

    if (!levelData || levelData.length === 0) {
      console.error('levelDataが空です');
      alert('水準狂いデータがありません。作業区間の切取りを実行してください。');
      return;
    }

    if (!cantData || cantData.length === 0) {
      console.error('cantDataが空です');
      alert('カントデータがありません。作業区間の切取りを実行してください。');
      return;
    }

    setIsAutoAligning(true);
    let maxCorr = -Infinity;
    let optimalOffset = 0;

    // -50m から +50m の範囲で探索
    for (let testOffset = -50; testOffset <= 50; testOffset += 0.5) {
      const corr = calculateCorrelation(testOffset);
      if (corr > maxCorr) {
        maxCorr = corr;
        optimalOffset = testOffset;
      }
    }

    console.log('最適オフセット:', optimalOffset, 'スコア:', maxCorr);

    setBestOffset(optimalOffset);
    setOffset(optimalOffset);
    setCorrelationScore(maxCorr);
    setIsAutoAligning(false);

    // グローバル状態を更新
    dispatch({
      type: 'ALIGN_POSITION',
      payload: { aligned: true }
    });

    if (onAlignmentComplete) {
      onAlignmentComplete(optimalOffset);
    }
  };

  // 手動調整
  const handleManualAdjust = (delta: number) => {
    const newOffset = offset + delta;
    setOffset(newOffset);
    const corr = calculateCorrelation(newOffset);
    setCorrelationScore(corr);
  };

  // チャートデータの準備
  const prepareChartData = () => {
    const shiftedPositions = positions.map(p => p + offset);

    return {
      labels: positions.map(p => p.toFixed(1)),
      datasets: [
        {
          label: '水準狂い（レベル）',
          data: levelData,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'カント',
          data: cantData,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'カント（調整後）',
          data: cantData.map((_, i) => {
            const adjustedIndex = i + Math.floor(offset / 0.25);
            return adjustedIndex >= 0 && adjustedIndex < cantData.length
              ? cantData[adjustedIndex]
              : 0;
          }),
          borderColor: 'rgb(255, 206, 86)',
          backgroundColor: 'rgba(255, 206, 86, 0.1)',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 5]
        }
      ]
    };
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '位置合わせ - 水準狂いとカント重ね合わせ'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '位置 (m)'
        },
        min: panPosition,
        max: panPosition + 1000 / zoomLevel
      },
      y: {
        title: {
          display: true,
          text: '変位量 (mm)'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div style={{ padding: '20px', background: 'white', borderRadius: '8px' }}>
      <h2 style={{ marginBottom: '20px' }}>🎯 位置合わせ処理</h2>

      {/* ステータス表示 */}
      <div style={{
        padding: '15px',
        background: state.status.positionAligned ? '#e8f5e9' : '#fff3e0',
        borderRadius: '6px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>ステータス:</strong>
            {state.status.positionAligned ? (
              <span style={{ color: '#4caf50', marginLeft: '10px' }}>
                ✓ 位置合わせ完了
              </span>
            ) : (
              <span style={{ color: '#ff9800', marginLeft: '10px' }}>
                ⏳ 位置合わせ未実施
              </span>
            )}
          </div>
          <div>
            <strong>相関スコア:</strong>
            <span style={{
              marginLeft: '10px',
              color: correlationScore > 0.7 ? '#4caf50' : correlationScore > 0.4 ? '#ff9800' : '#f44336'
            }}>
              {(correlationScore * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* コントロールパネル */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* 自動調整 */}
        <div style={{ padding: '15px', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>自動調整</h3>
          <button
            onClick={autoAlign}
            disabled={isAutoAligning || levelData.length === 0}
            style={{
              width: '100%',
              padding: '10px',
              background: isAutoAligning ? '#ccc' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isAutoAligning ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {isAutoAligning ? '⏳ 処理中...' : '🔄 自動位置合わせ実行'}
          </button>
          {bestOffset !== 0 && (
            <div style={{ marginTop: '10px', fontSize: '14px' }}>
              最適オフセット: <strong>{bestOffset.toFixed(2)}m</strong>
            </div>
          )}
        </div>

        {/* 手動調整 */}
        <div style={{ padding: '15px', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>
            手動調整
            <label style={{ marginLeft: '10px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(e) => setManualMode(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              有効
            </label>
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleManualAdjust(-1)}
              disabled={!manualMode}
              style={{
                flex: 1,
                padding: '8px',
                background: manualMode ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: manualMode ? 'pointer' : 'not-allowed'
              }}
            >
              ← -1m
            </button>
            <button
              onClick={() => handleManualAdjust(-0.25)}
              disabled={!manualMode}
              style={{
                flex: 1,
                padding: '8px',
                background: manualMode ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: manualMode ? 'pointer' : 'not-allowed'
              }}
            >
              ← -0.25m
            </button>
            <button
              onClick={() => handleManualAdjust(0.25)}
              disabled={!manualMode}
              style={{
                flex: 1,
                padding: '8px',
                background: manualMode ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: manualMode ? 'pointer' : 'not-allowed'
              }}
            >
              +0.25m →
            </button>
            <button
              onClick={() => handleManualAdjust(1)}
              disabled={!manualMode}
              style={{
                flex: 1,
                padding: '8px',
                background: manualMode ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: manualMode ? 'pointer' : 'not-allowed'
              }}
            >
              +1m →
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '14px' }}>
            現在のオフセット: <strong>{offset.toFixed(2)}m</strong>
          </div>
        </div>

        {/* ズーム・パン制御 */}
        <div style={{ padding: '15px', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>表示制御</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '14px' }}>
              ズーム:
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                style={{ marginLeft: '10px', width: '100px' }}
              />
              <span style={{ marginLeft: '10px' }}>{zoomLevel}x</span>
            </label>
          </div>
          <div>
            <label style={{ fontSize: '14px' }}>
              位置:
              <input
                type="range"
                min="0"
                max={Math.max(0, positions.length * 0.25 - 1000)}
                step="10"
                value={panPosition}
                onChange={(e) => setPanPosition(Number(e.target.value))}
                style={{ marginLeft: '10px', width: '100px' }}
              />
              <span style={{ marginLeft: '10px' }}>{panPosition}m</span>
            </label>
          </div>
        </div>
      </div>

      {/* グラフ表示 */}
      <div style={{ height: '400px', marginBottom: '20px' }}>
        {levelData.length > 0 && cantData.length > 0 ? (
          <Line ref={chartRef} data={prepareChartData()} options={chartOptions} />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            borderRadius: '6px'
          }}>
            <p style={{ color: '#999' }}>データが読み込まれていません</p>
          </div>
        )}
      </div>

      {/* 操作説明 */}
      <div style={{
        padding: '15px',
        background: '#f5f5f5',
        borderRadius: '6px',
        fontSize: '14px'
      }}>
        <h4 style={{ marginBottom: '10px' }}>📖 使用方法</h4>
        <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
          <li>「自動位置合わせ実行」をクリックして、最適な位置を自動検出</li>
          <li>必要に応じて「手動調整」を有効にして微調整</li>
          <li>相関スコアが70%以上になることを目標に調整</li>
          <li>グラフで水準狂い（青）とカント（黄色の破線）が重なることを確認</li>
        </ol>
        <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
          <strong>💡 ヒント:</strong> WB区間の前後では特に慎重に位置合わせを行ってください。
          自動調整後に手動で微調整することで、より精度の高い位置合わせが可能です。
        </div>
      </div>

      {/* 完了ボタン */}
      {correlationScore > 0.4 && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => {
              dispatch({
                type: 'ALIGN_POSITION',
                payload: { aligned: true }
              });
              if (onAlignmentComplete) {
                onAlignmentComplete(offset);
              }
              alert(`位置合わせを完了しました。\nオフセット: ${offset.toFixed(2)}m\n相関スコア: ${(correlationScore * 100).toFixed(1)}%`);
            }}
            style={{
              padding: '12px 30px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✓ 位置合わせを確定
          </button>
        </div>
      )}
    </div>
  );
};