/**
 * 作業区間設定ページ
 * PDF P21-22の仕様に基づく実装
 */

import React, { useState } from 'react';
import { PresetButtons } from '../components/StandardButton';
import './PageStyles.css';

export const WorkSectionPage: React.FC = () => {
  const [workSection, setWorkSection] = useState({
    lineName: '',
    lineDirection: 'down',
    workDirection: 'forward',
    startPosition: 0,
    endPosition: 0,
    bufferBefore: 500,
    bufferAfter: 500
  });

  const [errors, setErrors] = useState<string[]>([]);

  const handleInputChange = (field: string, value: any) => {
    setWorkSection({ ...workSection, [field]: value });
    validateSection();
  };

  const validateSection = () => {
    const newErrors: string[] = [];

    if (workSection.startPosition >= workSection.endPosition) {
      newErrors.push('作業開始位置が終了位置より後になっています');
    }

    if (workSection.bufferBefore < 500) {
      newErrors.push('前方バッファは500m以上を推奨します');
    }

    if (workSection.bufferAfter < 500) {
      newErrors.push('後方バッファは500m以上を推奨します');
    }

    setErrors(newErrors);
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/mtt/work-section', {
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
              />
            </div>

            <div className="form-group">
              <label>線別</label>
              <select
                value={workSection.lineDirection}
                onChange={(e) => handleInputChange('lineDirection', e.target.value)}
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
              <label>作業開始位置 (m)</label>
              <input
                type="number"
                value={workSection.startPosition}
                onChange={(e) => handleInputChange('startPosition', Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>作業終了位置 (m)</label>
              <input
                type="number"
                value={workSection.endPosition}
                onChange={(e) => handleInputChange('endPosition', Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>前方バッファ (m)</label>
              <input
                type="number"
                value={workSection.bufferBefore}
                onChange={(e) => handleInputChange('bufferBefore', Number(e.target.value))}
              />
              <small>推奨: 500m以上</small>
            </div>

            <div className="form-group">
              <label>後方バッファ (m)</label>
              <input
                type="number"
                value={workSection.bufferAfter}
                onChange={(e) => handleInputChange('bufferAfter', Number(e.target.value))}
              />
              <small>推奨: 500m以上</small>
            </div>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="alert alert-warning">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}

      <div className="action-buttons">
        <PresetButtons.Save onClick={handleSave} />
      </div>

      {workSection.startPosition > 0 && workSection.endPosition > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>作業区間サマリー</h2>
          </div>
          <div className="card-body">
            <p>作業延長: <strong>{workSection.endPosition - workSection.startPosition}m</strong></p>
            <p>データ取得範囲: <strong>
              {workSection.endPosition - workSection.startPosition + workSection.bufferBefore + workSection.bufferAfter}m
            </strong></p>
          </div>
        </div>
      )}
    </div>
  );
};