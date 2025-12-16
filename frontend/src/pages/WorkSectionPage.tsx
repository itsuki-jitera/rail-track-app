/**
 * 作業区間設定ページ
 * PDF P21-22の仕様に基づく実装
 * 実運用フローに対応した拡張版
 */

import React, { useState, useEffect } from 'react';
import { PresetButtons } from '../components/StandardButton';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';
import { NumericInput } from '../components/NumericInput';
import './PageStyles.css';

const API_BASE_URL = 'http://localhost:3003';

// WB区間の型定義
interface WBSection {
  start: number;
  end: number;
  type: 'WB' | 'W';
  description: string;
}

export const WorkSectionPage: React.FC = () => {
  const { state, dispatch } = useGlobalWorkspace();

  const [workSection, setWorkSection] = useState<{
    lineName: string;
    lineDirection: string;
    workDirection: string;
    startKm: string;
    endKm: string;
    startPosition: number | '';
    endPosition: number | '';
    bufferBefore: number;
    bufferAfter: number;
    autoAdjust: boolean;
    avoidWBSections: boolean;
  }>({
    lineName: '',
    lineDirection: 'down',
    workDirection: 'forward',
    startKm: '',
    endKm: '',
    startPosition: '',
    endPosition: '',
    bufferBefore: 500,
    bufferAfter: 500,
    autoAdjust: false, // 自動調整機能（デフォルト無効）
    avoidWBSections: false, // WB区間回避機能（デフォルト無効）
  });

  const [wbSections, setWbSections] = useState<WBSection[]>([
    // 実際のMTTデータから読み込むまでは空配列
    // サンプルデータは削除（1000m付近での自動調整を防ぐため）
  ]);

  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cutData, setCutData] = useState<any>(null);

  // グローバル状態からデータ読込状態を確認
  const isDataLoaded = state.status.dataLoaded;
  const mttData = state.originalData.mttData;

  useEffect(() => {
    // MTTデータからWB区間情報を取得（実装例）
    if (mttData && mttData.rawData) {
      // 実際のWB区間データを設定
      // setWbSections(mttData.rawData.wbSections || []);
    }
  }, [mttData]);

  // 自動バッファ調整（ユーザーが明示的に実行した場合のみ）
  const autoAdjustBuffer = () => {
    if (!workSection.autoAdjust) return;

    const newWarnings: string[] = [];
    let adjustedStart = workSection.startPosition === '' ? 0 : workSection.startPosition;
    let adjustedEnd = workSection.endPosition === '' ? 1000 : workSection.endPosition;
    let hasAdjustments = false;

    // WB区間との距離をチェック
    wbSections.forEach(wb => {
      const startDistance = Math.abs(adjustedStart - wb.start);
      const endDistance = Math.abs(adjustedEnd - wb.end);

      if (startDistance < 50) {
        newWarnings.push(`作業開始位置が${wb.description}のWB区間に近すぎます（${startDistance}m）`);
        // 自動調整（ユーザーが明示的にボタンを押した場合のみ）
        if (workSection.avoidWBSections) {
          adjustedStart = wb.start - 50;
          hasAdjustments = true;
        }
      }

      if (endDistance < 50) {
        newWarnings.push(`作業終了位置が${wb.description}のWB区間に近すぎます（${endDistance}m）`);
        // 自動調整（ユーザーが明示的にボタンを押した場合のみ）
        if (workSection.avoidWBSections) {
          adjustedEnd = wb.end + 50;
          hasAdjustments = true;
        }
      }
    });

    // ユーザーが明示的にボタンを押した場合のみ値を更新
    if (hasAdjustments) {
      setWorkSection({
        ...workSection,
        startPosition: adjustedStart,
        endPosition: adjustedEnd,
      });
      alert(`WB区間を回避するために位置を調整しました。\n開始位置: ${adjustedStart}m\n終了位置: ${adjustedEnd}m`);
    }
    setWarnings(newWarnings);
  };

  const handleInputChange = (field: string, value: any) => {
    setWorkSection({ ...workSection, [field]: value });
    // validateSection()を削除して自動調整を防ぐ
    // バリデーションは切取り実行時のみ行う
  };

  const validateSection = () => {
    const newErrors: string[] = [];
    const newWarnings: string[] = [];

    // データ読込チェック
    if (!isDataLoaded) {
      newErrors.push('MTTデータが読み込まれていません。まずデータを読み込んでください。');
    }

    // 数値に変換
    const startPos = workSection.startPosition === '' ? 0 : workSection.startPosition;
    const endPos = workSection.endPosition === '' ? 0 : workSection.endPosition;

    // 基本的なバリデーション
    if (startPos >= endPos) {
      newErrors.push('作業開始位置が終了位置より後になっています');
    }

    // バッファチェック（500m以上を強く推奨）
    if (workSection.bufferBefore < 500) {
      newWarnings.push(`前方バッファが推奨値（500m）より小さいです（現在: ${workSection.bufferBefore}m）`);
    }
    if (workSection.bufferAfter < 500) {
      newWarnings.push(`後方バッファが推奨値（500m）より小さいです（現在: ${workSection.bufferAfter}m）`);
    }

    // WB区間チェック
    wbSections.forEach(wb => {
      if (startPos >= wb.start && startPos <= wb.end) {
        newErrors.push(`作業開始位置が${wb.description}のWB区間内にあります`);
      }
      if (endPos >= wb.start && endPos <= wb.end) {
        newErrors.push(`作業終了位置が${wb.description}のWB区間内にあります`);
      }
    });

    setErrors(newErrors);
    setWarnings(newWarnings);
  };

  const handleCutSection = async () => {
    // 切取り実行時にバリデーションを行う
    validateSection();

    if (errors.length > 0) {
      alert('エラーを修正してから切取りを実行してください');
      return;
    }

    // 数値に変換（空文字列の場合はデフォルト値を使用）
    const startPos = workSection.startPosition === '' ? 0 : workSection.startPosition;
    const endPos = workSection.endPosition === '' ? 1000 : workSection.endPosition;

    console.log('handleCutSection - workSection.startPosition:', workSection.startPosition);
    console.log('handleCutSection - workSection.endPosition:', workSection.endPosition);
    console.log('handleCutSection - startPos:', startPos);
    console.log('handleCutSection - endPos:', endPos);

    if (startPos >= endPos) {
      alert('作業終了位置は開始位置より後に設定してください');
      return;
    }

    try {
      // 実際の切取り範囲を計算
      const actualStart = startPos - workSection.bufferBefore;
      const actualEnd = endPos + workSection.bufferAfter;

      console.log('handleCutSection - actualStart:', actualStart);
      console.log('handleCutSection - actualEnd:', actualEnd);

      const response = await fetch(`${API_BASE_URL}/api/mtt/cut-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workSection,
          actualStart,
          actualEnd,
        })
      });

      const result = await response.json();
      if (result.success) {
        setCutData(result.data);

        // デバッグログ
        console.log('切取りデータ:', result.data);
        console.log('positions長さ:', result.data.positions?.length || 0);
        console.log('level長さ:', result.data.level?.length || 0);
        console.log('cant長さ:', result.data.cant?.length || 0);

        // グローバル状態を更新
        dispatch({
          type: 'SET_WORK_SECTION',
          payload: {
            startKm: workSection.startKm,
            endKm: workSection.endKm,
            startPos: startPos,
            endPos: endPos,
            bufferStart: workSection.bufferBefore,
            bufferEnd: workSection.bufferAfter,
            wbSections: wbSections.filter(wb =>
              wb.start >= actualStart && wb.end <= actualEnd
            ),
          }
        });

        dispatch({
          type: 'CUT_SECTION',
          payload: result.data // 切取られたデータ
        });

        alert(`作業区間を切り取りました\n範囲: ${actualStart}m ～ ${actualEnd}m\n全長: ${actualEnd - actualStart}m`);
      }
    } catch (error) {
      console.error('切取りエラー:', error);
      alert('切取りに失敗しました');
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mtt/work-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workSection)
      });

      const result = await response.json();
      if (result.success) {
        alert('作業区間設定を保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📍 作業区間設定</h1>
        <p>MTT作業を行う区間の詳細を設定します（PDF P21-22準拠）</p>
      </div>

      {/* データ読込状態の表示 */}
      {!isDataLoaded && (
        <div className="alert alert-warning">
          <h3>⚠️ データが読み込まれていません</h3>
          <p>作業区間を設定する前に、まず「🚃 キヤデータ読込」からMTTデータをアップロードしてください。</p>
        </div>
      )}

      {isDataLoaded && mttData && (
        <div className="alert alert-info" style={{ background: '#e3f2fd', border: '1px solid #1976d2' }}>
          <h3>✓ データ読込済み</h3>
          <p>ファイル: <strong>{mttData.filename}</strong></p>
          <p>全長: <strong>{mttData.metadata.totalLength}km</strong></p>
        </div>
      )}

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>基本情報</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>線名</label>
              <input
                type="text"
                value={workSection.lineName}
                onChange={(e) => handleInputChange('lineName', e.target.value)}
                placeholder="例: 東海道線"
                disabled={!isDataLoaded}
              />
            </div>

            <div className="form-group">
              <label>線別</label>
              <select
                value={workSection.lineDirection}
                onChange={(e) => handleInputChange('lineDirection', e.target.value)}
                disabled={!isDataLoaded}
              >
                <option value="up">上り</option>
                <option value="down">下り</option>
                <option value="single">単線</option>
              </select>
            </div>

            <div className="form-group">
              <label>作業方向</label>
              <select
                value={workSection.workDirection}
                onChange={(e) => handleInputChange('workDirection', e.target.value)}
                disabled={!isDataLoaded}
              >
                <option value="forward">下り方向</option>
                <option value="backward">上り方向</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>作業区間</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>作業開始キロ程 (km)</label>
              <input
                type="number"
                value={workSection.startKm}
                onChange={(e) => handleInputChange('startKm', e.target.value)}
                step="0.001"
                placeholder="0.000"
                disabled={!isDataLoaded}
              />
            </div>

            <div className="form-group">
              <label>作業終了キロ程 (km)</label>
              <input
                type="number"
                value={workSection.endKm}
                onChange={(e) => handleInputChange('endKm', e.target.value)}
                step="0.001"
                placeholder="0.000"
                disabled={!isDataLoaded}
              />
            </div>

            <div className="form-group">
              <label>作業開始位置 (m)</label>
              <NumericInput
                value={workSection.startPosition}
                onChange={(value) => handleInputChange('startPosition', value)}
                placeholder="0"
                disabled={!isDataLoaded}
                min={0}
              />
            </div>

            <div className="form-group">
              <label>作業終了位置 (m)</label>
              <NumericInput
                value={workSection.endPosition}
                onChange={(value) => handleInputChange('endPosition', value)}
                placeholder="0"
                disabled={!isDataLoaded}
                min={0}
              />
            </div>

            <div className="form-group">
              <label>
                前方バッファ (m)
                <span style={{ color: '#ff6b6b', marginLeft: '10px' }}>※ 500m以上必須</span>
              </label>
              <NumericInput
                value={workSection.bufferBefore}
                onChange={(value) => handleInputChange('bufferBefore', value || 500)}
                min={500}
                style={{
                  borderColor: workSection.bufferBefore < 500 ? '#ff6b6b' : '#28a745',
                  borderWidth: '2px'
                }}
                disabled={!isDataLoaded}
                placeholder="500"
              />
              <small>推奨: 500m以上（復元波形計算の精度確保のため）</small>
            </div>

            <div className="form-group">
              <label>
                後方バッファ (m)
                <span style={{ color: '#ff6b6b', marginLeft: '10px' }}>※ 500m以上必須</span>
              </label>
              <NumericInput
                value={workSection.bufferAfter}
                onChange={(value) => handleInputChange('bufferAfter', value || 500)}
                min={500}
                style={{
                  borderColor: workSection.bufferAfter < 500 ? '#ff6b6b' : '#28a745',
                  borderWidth: '2px'
                }}
                disabled={!isDataLoaded}
                placeholder="500"
              />
              <small>推奨: 500m以上（復元波形計算の精度確保のため）</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>自動調整オプション</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workSection.autoAdjust}
                  onChange={(e) => handleInputChange('autoAdjust', e.target.checked)}
                  style={{ marginRight: '10px', width: 'auto' }}
                  disabled={!isDataLoaded}
                />
                バッファを自動調整する
              </label>
              <small>WB区間に近い場合、自動的に調整します</small>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workSection.avoidWBSections}
                  onChange={(e) => handleInputChange('avoidWBSections', e.target.checked)}
                  style={{ marginRight: '10px', width: 'auto' }}
                  disabled={!isDataLoaded}
                />
                WB区間を自動回避する
              </label>
              <small>WB区間の始終点から50m以上離れた点で切取ります</small>
            </div>

            {workSection.autoAdjust && (
              <button
                className="btn btn-secondary"
                onClick={autoAdjustBuffer}
                disabled={!isDataLoaded}
              >
                自動調整を実行
              </button>
            )}
          </div>
        </div>

        {/* WB区間情報の表示 */}
        {wbSections.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2>WB区間情報</h2>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>開始位置</th>
                    <th>終了位置</th>
                    <th>種別</th>
                    <th>説明</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {wbSections.map((wb, index) => {
                    const startPos = workSection.startPosition === '' ? 0 : workSection.startPosition;
                    const endPos = workSection.endPosition === '' ? 1000 : workSection.endPosition;

                    const isInWorkSection =
                      wb.start >= startPos - workSection.bufferBefore &&
                      wb.end <= endPos + workSection.bufferAfter;

                    const isTooClose =
                      Math.abs(startPos - wb.start) < 50 ||
                      Math.abs(startPos - wb.end) < 50 ||
                      Math.abs(endPos - wb.start) < 50 ||
                      Math.abs(endPos - wb.end) < 50;

                    return (
                      <tr key={index} style={{
                        background: isTooClose ? '#ffebee' : isInWorkSection ? '#e8f5e9' : 'white'
                      }}>
                        <td>{wb.start}m</td>
                        <td>{wb.end}m</td>
                        <td>
                          <span className={`badge ${wb.type === 'WB' ? 'badge-warning' : 'badge-info'}`}>
                            {wb.type}
                          </span>
                        </td>
                        <td>{wb.description}</td>
                        <td>
                          {isTooClose ? (
                            <span style={{ color: '#f44336' }}>⚠️ 近接</span>
                          ) : isInWorkSection ? (
                            <span style={{ color: '#4caf50' }}>✓ 含まれる</span>
                          ) : (
                            <span style={{ color: '#9e9e9e' }}>対象外</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {errors.length > 0 && (
        <div className="alert alert-danger">
          <h3>エラー</h3>
          {errors.map((error, index) => (
            <p key={index}>• {error}</p>
          ))}
        </div>
      )}

      {/* 警告表示 */}
      {warnings.length > 0 && (
        <div className="alert alert-warning">
          <h3>警告</h3>
          {warnings.map((warning, index) => (
            <p key={index}>• {warning}</p>
          ))}
        </div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleCutSection}
          disabled={!isDataLoaded || errors.length > 0}
        >
          📋 区間切取り実行
        </button>
        <PresetButtons.Save onClick={handleSave} disabled={!isDataLoaded} />
      </div>

      {/* サマリー表示 */}
      {workSection.startPosition !== '' && workSection.endPosition !== '' && (
        <div className="card">
          <div className="card-header">
            <h2>作業区間サマリー</h2>
          </div>
          <div className="card-body">
            <div className="summary-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px'
            }}>
              <div>
                <p className="summary-label">作業延長:</p>
                <p className="summary-value">
                  <strong>{workSection.endPosition - workSection.startPosition}m</strong>
                </p>
              </div>
              <div>
                <p className="summary-label">実際の切取り範囲:</p>
                <p className="summary-value">
                  <strong>
                    {workSection.startPosition - workSection.bufferBefore}m ～ {workSection.endPosition + workSection.bufferAfter}m
                  </strong>
                </p>
              </div>
              <div>
                <p className="summary-label">総データ長:</p>
                <p className="summary-value">
                  <strong>
                    {workSection.endPosition - workSection.startPosition + workSection.bufferBefore + workSection.bufferAfter}m
                  </strong>
                </p>
              </div>
              <div>
                <p className="summary-label">前方バッファ:</p>
                <p className="summary-value" style={{
                  color: workSection.bufferBefore >= 500 ? '#28a745' : '#ff6b6b'
                }}>
                  <strong>{workSection.bufferBefore}m</strong>
                  {workSection.bufferBefore >= 500 ? ' ✓' : ' ⚠️'}
                </p>
              </div>
              <div>
                <p className="summary-label">後方バッファ:</p>
                <p className="summary-value" style={{
                  color: workSection.bufferAfter >= 500 ? '#28a745' : '#ff6b6b'
                }}>
                  <strong>{workSection.bufferAfter}m</strong>
                  {workSection.bufferAfter >= 500 ? ' ✓' : ' ⚠️'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 切取りデータプレビュー */}
      {cutData && (
        <div className="card">
          <div className="card-header">
            <h2>切取りデータプレビュー</h2>
          </div>
          <div className="card-body">
            <p>データポイント数: <strong>{cutData.dataPoints || 0}</strong></p>
            <p>含まれるWB区間: <strong>{cutData.wbSections || 0}</strong></p>
            <p>ステータス: <span style={{ color: '#4caf50' }}>✓ 切取り完了</span></p>
          </div>
        </div>
      )}
    </div>
  );
};