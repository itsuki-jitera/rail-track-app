/**
 * 位置合わせ処理ページ
 * 水準狂いとカントデータの位置合わせを行う
 * 実運用フローに必須の処理
 */

import React, { useState, useEffect } from 'react';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';
import { PositionAlignment } from '../components/PositionAlignment';
import './PageStyles.css';

export const PositionAlignmentPage: React.FC = () => {
  const { state, dispatch, getNextRequiredStep } = useGlobalWorkspace();

  const [alignmentResult, setAlignmentResult] = useState<{
    offset: number;
    correlationScore: number;
    timestamp: Date;
  } | null>(null);

  // データ読込とセクション切取りの確認
  const isDataReady = state.status.dataLoaded && state.status.sectionCut;
  const kiyaData = state.originalData.kiyaData;
  const workSection = state.settings.workSection;

  // デバッグログ
  console.log('PositionAlignmentPage - isDataReady:', isDataReady);
  console.log('PositionAlignmentPage - kiyaData:', kiyaData);
  console.log('PositionAlignmentPage - kiyaData?.level length:', kiyaData?.level?.length || 0);
  console.log('PositionAlignmentPage - kiyaData?.cant length:', kiyaData?.cant?.length || 0);

  const handleAlignmentComplete = (offset: number) => {
    setAlignmentResult({
      offset,
      correlationScore: 0, // 実際の相関スコアはコンポーネント内で計算
      timestamp: new Date()
    });

    // グローバル状態を更新
    dispatch({
      type: 'ALIGN_POSITION',
      payload: { aligned: true }
    });

    dispatch({
      type: 'ADD_HISTORY',
      payload: {
        action: '位置合わせ完了',
        details: { offset, timestamp: new Date() }
      }
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🎯 位置合わせ処理</h1>
        <p>水準狂いとカントデータを重ね合わせて正確な位置を特定します</p>
      </div>

      {/* 前提条件チェック */}
      {!isDataReady ? (
        <div className="alert alert-warning">
          <h3>⚠️ 前提条件が満たされていません</h3>
          <p>位置合わせを実行するには、以下の作業を完了してください：</p>
          <ol>
            <li style={{
              textDecoration: state.status.dataLoaded ? 'line-through' : 'none',
              color: state.status.dataLoaded ? '#999' : 'inherit'
            }}>
              {state.status.dataLoaded ? '✓' : '○'} MTTデータの読込
            </li>
            <li style={{
              textDecoration: state.status.sectionCut ? 'line-through' : 'none',
              color: state.status.sectionCut ? '#999' : 'inherit'
            }}>
              {state.status.sectionCut ? '✓' : '○'} 作業区間の切取り
            </li>
          </ol>
          {getNextRequiredStep() && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#fff3e0', borderRadius: '6px' }}>
              <strong>次のステップ:</strong> {getNextRequiredStep()}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* データ情報表示 */}
          <div className="content-grid">
            <div className="card">
              <div className="card-header">
                <h2>データ情報</h2>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div>
                    <strong>データソース:</strong>
                    <p>{state.originalData.mttData?.filename || 'N/A'}</p>
                  </div>
                  <div>
                    <strong>作業区間:</strong>
                    <p>{workSection?.startPos || 0}m ～ {workSection?.endPos || 0}m</p>
                  </div>
                  <div>
                    <strong>データポイント数:</strong>
                    <p>{kiyaData?.positions?.length || 0} 点</p>
                  </div>
                  <div>
                    <strong>測定間隔:</strong>
                    <p>0.25m</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 処理状態 */}
            <div className="card">
              <div className="card-header">
                <h2>処理状態</h2>
              </div>
              <div className="card-body">
                <div style={{
                  padding: '20px',
                  background: state.status.positionAligned ? '#e8f5e9' : '#f5f5f5',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  {state.status.positionAligned ? (
                    <>
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
                      <h3 style={{ color: '#4caf50', marginBottom: '10px' }}>位置合わせ完了</h3>
                      {alignmentResult && (
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          <p>オフセット: {alignmentResult.offset.toFixed(2)}m</p>
                          <p>実施日時: {alignmentResult.timestamp.toLocaleString('ja-JP')}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏳</div>
                      <h3 style={{ color: '#ff9800', marginBottom: '10px' }}>位置合わせ未実施</h3>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        下のパネルで位置合わせを実行してください
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 位置合わせコンポーネント */}
          <div style={{ marginTop: '20px' }}>
            <PositionAlignment
              levelData={kiyaData?.level}
              cantData={kiyaData?.cant}
              positions={kiyaData?.positions}
              onAlignmentComplete={handleAlignmentComplete}
            />
          </div>

          {/* 操作ガイド */}
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <h2>📖 操作ガイド</h2>
            </div>
            <div className="card-body">
              <div className="info-box">
                <h3>位置合わせの重要性</h3>
                <p>
                  位置合わせは、測定データと実際の線路位置を正確に対応させる重要な処理です。
                  特にWB区間（橋梁、トンネル等）の前後では、正確な位置合わせが必須となります。
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3>処理手順</h3>
                <ol style={{ lineHeight: '2em' }}>
                  <li>
                    <strong>自動位置合わせ</strong>
                    <ul>
                      <li>「自動位置合わせ実行」ボタンをクリック</li>
                      <li>システムが最適な位置を自動検出</li>
                      <li>相関スコアが70%以上になることを確認</li>
                    </ul>
                  </li>
                  <li>
                    <strong>手動微調整（必要に応じて）</strong>
                    <ul>
                      <li>「手動調整」を有効化</li>
                      <li>±0.25m、±1mボタンで微調整</li>
                      <li>グラフで重なり具合を確認</li>
                    </ul>
                  </li>
                  <li>
                    <strong>位置合わせの確定</strong>
                    <ul>
                      <li>満足のいく結果が得られたら「位置合わせを確定」をクリック</li>
                      <li>オフセット値が記録され、以降の処理で使用されます</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div className="warning-box" style={{ marginTop: '20px' }}>
                <h3>⚠️ 注意事項</h3>
                <ul>
                  <li>位置合わせは一度確定すると、後続の処理に影響します</li>
                  <li>相関スコアが40%未満の場合は、データの確認が必要です</li>
                  <li>WB区間付近では特に慎重に調整してください</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PositionAlignmentPage;