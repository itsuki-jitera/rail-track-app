/**
 * 曲線情報一覧コンポーネント
 * キヤデータから取得した曲線情報を表示
 */
import React from 'react'
import { useKiyaStore } from '../stores/kiyaStore'
import type { Curve } from '../types/kiya-data'
import '../styles/CurveList.css'

export const CurveList: React.FC = () => {
  const { curves, selectedCurveId, selectCurve, structures } = useKiyaStore()

  if (curves.length === 0) {
    return (
      <div className="curve-list-empty">
        <p>曲線データがありません</p>
        <p className="hint">CKファイルをアップロードしてください</p>
      </div>
    )
  }

  // 有効な曲線のみフィルタ（半径とカントが設定されているもの）
  const validCurves = curves.filter(
    curve => curve.radius !== null && curve.cant !== null
  )

  const handleCurveClick = (curve: Curve) => {
    selectCurve(selectedCurveId === curve.id ? null : curve.id)
  }

  const getCurveLabel = (curve: Curve): string => {
    if (!curve.radius) return '緩和曲線'
    return `R${curve.radius}m`
  }

  const getDirectionLabel = (direction: 'left' | 'right' | null): string => {
    if (direction === 'left') return '左'
    if (direction === 'right') return '右'
    return '-'
  }

  return (
    <div className="curve-list-container">
      <div className="curve-list-header">
        <h3>曲線情報</h3>
        <div className="curve-count">
          <span className="count">{validCurves.length}</span>
          <span className="label">/ {curves.length} 曲線</span>
        </div>
      </div>

      <div className="curve-stats">
        <div className="stat-item">
          <span className="stat-label">構造物:</span>
          <span className="stat-value">{structures.length}</span>
        </div>
      </div>

      <div className="curve-list">
        {validCurves.map((curve, index) => (
          <div
            key={curve.id}
            className={`curve-item ${selectedCurveId === curve.id ? 'selected' : ''}`}
            onClick={() => handleCurveClick(curve)}
          >
            <div className="curve-header">
              <span className="curve-number">#{index + 1}</span>
              <span className={`curve-direction ${curve.direction}`}>
                {getDirectionLabel(curve.direction)}
              </span>
            </div>

            <div className="curve-body">
              <div className="curve-main">
                <span className="curve-label">{getCurveLabel(curve)}</span>
                {curve.cant && (
                  <span className="curve-cant">C={curve.cant}mm</span>
                )}
              </div>

              <div className="curve-location">
                <span className="km-start">{curve.start.toFixed(3)}km</span>
                <span className="separator">→</span>
                <span className="km-end">{curve.end?.toFixed(3) || '?'}km</span>
              </div>

              {curve.end && (
                <div className="curve-length">
                  延長: {((curve.end - curve.start) * 1000).toFixed(0)}m
                </div>
              )}
            </div>

            {selectedCurveId === curve.id && (
              <div className="curve-details">
                <div className="detail-row">
                  <span className="detail-label">開始</span>
                  <span className="detail-value">{curve.start.toFixed(3)} km</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">終了</span>
                  <span className="detail-value">
                    {curve.end?.toFixed(3) || '未設定'} km
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">半径</span>
                  <span className="detail-value">
                    {curve.radius ? `${curve.radius} m` : '未設定'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">カント</span>
                  <span className="detail-value">
                    {curve.cant ? `${curve.cant} mm` : '未設定'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">方向</span>
                  <span className="detail-value">
                    {getDirectionLabel(curve.direction)}曲線
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
