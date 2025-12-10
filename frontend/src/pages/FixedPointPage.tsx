/**
 * 固定点設定ページ
 * PDF P16-17の仕様に基づく実装
 * 軌道整正時に移動させない固定点を設定
 */

import React, { useState } from 'react';
import { StandardButton, PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

interface FixedPoint {
  id: string;
  position: number;
  type: 'absolute' | 'relative';
  description: string;
  tolerance: number;
}

export const FixedPointPage: React.FC = () => {
  const [fixedPoints, setFixedPoints] = useState<FixedPoint[]>([]);
  const [newPoint, setNewPoint] = useState<FixedPoint>({
    id: '',
    position: 0,
    type: 'absolute',
    description: '',
    tolerance: 0
  });

  const addFixedPoint = () => {
    if (!newPoint.position) {
      alert('位置を入力してください');
      return;
    }

    const point: FixedPoint = {
      ...newPoint,
      id: `FP-${Date.now()}`
    };

    setFixedPoints([...fixedPoints, point]);
    setNewPoint({
      id: '',
      position: 0,
      type: 'absolute',
      description: '',
      tolerance: 0
    });
  };

  const removeFixedPoint = (id: string) => {
    setFixedPoints(fixedPoints.filter(p => p.id !== id));
  };

  const saveFixedPoints = async () => {
    try {
      const response = await fetch('/api/fixed-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: fixedPoints })
      });

      if (response.ok) {
        alert('固定点設定を保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔒 固定点設定</h1>
        <p>軌道整正時に移動させない固定点を設定します（PDF P16-17準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>固定点追加</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>位置 (m)</label>
                <input
                  type="number"
                  value={newPoint.position}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    position: Number(e.target.value)
                  })}
                  placeholder="例: 1234.5"
                />
              </div>

              <div className="form-group">
                <label>固定タイプ</label>
                <select
                  value={newPoint.type}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    type: e.target.value as 'absolute' | 'relative'
                  })}
                >
                  <option value="absolute">絶対固定</option>
                  <option value="relative">相対固定</option>
                </select>
              </div>

              <div className="form-group">
                <label>許容値 (mm)</label>
                <input
                  type="number"
                  value={newPoint.tolerance}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    tolerance: Number(e.target.value)
                  })}
                  placeholder="例: 5"
                  min="0"
                  max="10"
                />
                <small>絶対固定の場合の許容移動量</small>
              </div>

              <div className="form-group">
                <label>説明</label>
                <input
                  type="text"
                  value={newPoint.description}
                  onChange={(e) => setNewPoint({
                    ...newPoint,
                    description: e.target.value
                  })}
                  placeholder="例: 橋梁始点、トンネル入口等"
                />
              </div>
            </div>

            <PresetButtons.Add
              label="固定点を追加"
              onClick={addFixedPoint}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>設定済み固定点一覧</h2>
          </div>
          <div className="card-body">
            {fixedPoints.length === 0 ? (
              <p className="text-muted">固定点が設定されていません</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>位置 (m)</th>
                      <th>タイプ</th>
                      <th>許容値</th>
                      <th>説明</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedPoints.map((point) => (
                      <tr key={point.id}>
                        <td>{point.position.toFixed(1)}</td>
                        <td>
                          {point.type === 'absolute' ? '絶対固定' : '相対固定'}
                        </td>
                        <td>{point.tolerance}mm</td>
                        <td>{point.description || '-'}</td>
                        <td>
                          <PresetButtons.Delete
                            size="small"
                            onClick={() => removeFixedPoint(point.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>固定点設定の注意事項</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📌 固定点タイプの説明</h3>
              <ul>
                <li><strong>絶対固定:</strong> 構造物境界など、絶対に移動させてはいけない点</li>
                <li><strong>相対固定:</strong> 周辺との関係性を保つ必要がある点</li>
              </ul>
            </div>

            <div className="info-box">
              <h3>⚠️ 設定時の注意</h3>
              <ul>
                <li>固定点は作業区間内に設定してください</li>
                <li>固定点間隔は最低100m以上を推奨</li>
                <li>橋梁、トンネル境界は必ず固定点に設定</li>
                <li>許容値は通常0-5mmの範囲で設定</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Save
          label="固定点設定を保存"
          onClick={saveFixedPoints}
        />
      </div>
    </div>
  );
};