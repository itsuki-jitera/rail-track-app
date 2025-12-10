/**
 * 移動量制限設定ページ
 * PDF P30-31の仕様に基づく実装
 * 軌道整正時の最大移動量制限を設定
 */

import React, { useState } from 'react';
import { PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

interface MovementLimit {
  sectionStart: number;
  sectionEnd: number;
  maxUpward: number;
  maxDownward: number;
  maxLeft: number;
  maxRight: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export const MovementLimitPage: React.FC = () => {
  const [limits, setLimits] = useState<MovementLimit[]>([]);
  const [globalLimits, setGlobalLimits] = useState({
    defaultMaxUpward: 50,
    defaultMaxDownward: 50,
    defaultMaxLeft: 50,
    defaultMaxRight: 50,
    enableGradualChange: true,
    gradualChangeRate: 10
  });

  const [newLimit, setNewLimit] = useState<MovementLimit>({
    sectionStart: 0,
    sectionEnd: 0,
    maxUpward: 30,
    maxDownward: 30,
    maxLeft: 30,
    maxRight: 30,
    reason: '',
    priority: 'medium'
  });

  const addLimit = () => {
    if (newLimit.sectionStart >= newLimit.sectionEnd) {
      alert('区間の終点は始点より後に設定してください');
      return;
    }

    setLimits([...limits, { ...newLimit }]);
    setNewLimit({
      sectionStart: 0,
      sectionEnd: 0,
      maxUpward: 30,
      maxDownward: 30,
      maxLeft: 30,
      maxRight: 30,
      reason: '',
      priority: 'medium'
    });
  };

  const removeLimit = (index: number) => {
    setLimits(limits.filter((_, i) => i !== index));
  };

  const saveLimits = async () => {
    try {
      const data = {
        globalLimits,
        sectionLimits: limits
      };

      const response = await fetch('/api/movement-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        alert('移動量制限設定を保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>⚠️ 移動量制限設定</h1>
        <p>軌道整正時の最大移動量を制限します（PDF P30-31準拠）</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h2>全体制限設定</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>標準最大上昇量 (mm)</label>
                <input
                  type="number"
                  value={globalLimits.defaultMaxUpward}
                  onChange={(e) => setGlobalLimits({
                    ...globalLimits,
                    defaultMaxUpward: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>標準最大下降量 (mm)</label>
                <input
                  type="number"
                  value={globalLimits.defaultMaxDownward}
                  onChange={(e) => setGlobalLimits({
                    ...globalLimits,
                    defaultMaxDownward: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>標準最大左移動量 (mm)</label>
                <input
                  type="number"
                  value={globalLimits.defaultMaxLeft}
                  onChange={(e) => setGlobalLimits({
                    ...globalLimits,
                    defaultMaxLeft: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>標準最大右移動量 (mm)</label>
                <input
                  type="number"
                  value={globalLimits.defaultMaxRight}
                  onChange={(e) => setGlobalLimits({
                    ...globalLimits,
                    defaultMaxRight: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={globalLimits.enableGradualChange}
                  onChange={(e) => setGlobalLimits({
                    ...globalLimits,
                    enableGradualChange: e.target.checked
                  })}
                />
                段階的変化を有効化
              </label>
            </div>

            {globalLimits.enableGradualChange && (
              <div className="form-group">
                <label>変化率 (mm/m)</label>
                <input
                  type="number"
                  value={globalLimits.gradualChangeRate}
                  onChange={(e) => setGlobalLimits({
                    ...globalLimits,
                    gradualChangeRate: Number(e.target.value)
                  })}
                  min="1"
                  max="20"
                />
                <small>制限区間境界での段階的変化率</small>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>区間別制限追加</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>開始位置 (m)</label>
                <input
                  type="number"
                  value={newLimit.sectionStart}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    sectionStart: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>終了位置 (m)</label>
                <input
                  type="number"
                  value={newLimit.sectionEnd}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    sectionEnd: Number(e.target.value)
                  })}
                />
              </div>

              <div className="form-group">
                <label>最大上昇量 (mm)</label>
                <input
                  type="number"
                  value={newLimit.maxUpward}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    maxUpward: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>最大下降量 (mm)</label>
                <input
                  type="number"
                  value={newLimit.maxDownward}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    maxDownward: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>最大左移動量 (mm)</label>
                <input
                  type="number"
                  value={newLimit.maxLeft}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    maxLeft: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>最大右移動量 (mm)</label>
                <input
                  type="number"
                  value={newLimit.maxRight}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    maxRight: Number(e.target.value)
                  })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>優先度</label>
                <select
                  value={newLimit.priority}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    priority: e.target.value as 'high' | 'medium' | 'low'
                  })}
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>

              <div className="form-group">
                <label>制限理由</label>
                <input
                  type="text"
                  value={newLimit.reason}
                  onChange={(e) => setNewLimit({
                    ...newLimit,
                    reason: e.target.value
                  })}
                  placeholder="例: 橋梁区間、道床厚不足"
                />
              </div>
            </div>

            <PresetButtons.Add onClick={addLimit} label="区間制限を追加" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>設定済み区間制限</h2>
          </div>
          <div className="card-body">
            {limits.length === 0 ? (
              <p className="text-muted">区間別制限が設定されていません</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>区間</th>
                      <th>上昇制限</th>
                      <th>下降制限</th>
                      <th>左制限</th>
                      <th>右制限</th>
                      <th>優先度</th>
                      <th>理由</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limits.map((limit, index) => (
                      <tr key={index}>
                        <td>{limit.sectionStart}-{limit.sectionEnd}m</td>
                        <td>{limit.maxUpward}mm</td>
                        <td>{limit.maxDownward}mm</td>
                        <td>{limit.maxLeft}mm</td>
                        <td>{limit.maxRight}mm</td>
                        <td>
                          <span className={`priority-${limit.priority}`}>
                            {limit.priority === 'high' ? '高' :
                             limit.priority === 'medium' ? '中' : '低'}
                          </span>
                        </td>
                        <td>{limit.reason || '-'}</td>
                        <td>
                          <PresetButtons.Delete
                            onClick={() => removeLimit(index)}
                            size="small"
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
            <h2>制限設定の推奨値</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h3>📊 標準的な制限値</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>通常区間:</td>
                    <td>±50mm</td>
                  </tr>
                  <tr>
                    <td>橋梁区間:</td>
                    <td>±30mm</td>
                  </tr>
                  <tr>
                    <td>トンネル区間:</td>
                    <td>±20mm</td>
                  </tr>
                  <tr>
                    <td>道床厚不足区間:</td>
                    <td>上昇0mm、下降50mm</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="warning-box">
              <h3>⚠️ 注意事項</h3>
              <ul>
                <li>構造物境界では急激な変化を避ける</li>
                <li>道床厚が不足している区間では上昇制限を厳しくする</li>
                <li>建築限界に近い区間では左右制限を厳しくする</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <PresetButtons.Save onClick={saveLimits} label="制限設定を保存" />
      </div>
    </div>
  );
};