import React, { useState } from 'react'
import './OutlierDetection.css'

interface Outlier {
  index: number
  distance: number
  value: number
  deviation: number
  type: 'high' | 'low'
}

interface OutlierDetectionProps {
  data: Array<{ distance: number; irregularity: number }>
  onOutliersDetected?: (outliers: Outlier[]) => void
}

const OutlierDetection: React.FC<OutlierDetectionProps> = ({ data, onOutliersDetected }) => {
  const [sigmaMul, setSigmaMul] = useState<number>(3.0)
  const [outliers, setOutliers] = useState<Outlier[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDetectOutliers = async () => {
    if (!data || data.length === 0) {
      setError('データが空です')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3002/api/detect-outliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          sigmaMul,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setOutliers(result.outliers)
        if (onOutliersDetected) {
          onOutliersDetected(result.outliers)
        }
      } else {
        setError(result.error || '異常値検出に失敗しました')
      }
    } catch (err) {
      console.error('Outlier detection error:', err)
      setError('異常値検出中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSigmaChange = (value: number) => {
    setSigmaMul(value)
    // スライダー変更時は自動的に再検出しない（ボタンで実行）
  }

  const getSeverityColor = (deviation: number): string => {
    if (deviation >= 5) return '#d32f2f' // 赤（非常に高い）
    if (deviation >= 4) return '#f57c00' // オレンジ（高い）
    if (deviation >= 3) return '#fbc02d' // 黄色（中程度）
    return '#7cb342' // 緑（低い）
  }

  return (
    <div className="outlier-detection">
      <h3>🚨 異常値検出</h3>

      <div className="outlier-content">
        {/* 検出設定 */}
        <div className="detection-settings">
          <div className="sigma-control">
            <label htmlFor="sigma-slider">
              標準偏差倍率 (σ): <strong>{sigmaMul.toFixed(1)}</strong>
            </label>
            <input
              id="sigma-slider"
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={sigmaMul}
              onChange={(e) => handleSigmaChange(parseFloat(e.target.value))}
              disabled={loading}
            />
            <div className="sigma-range-labels">
              <span>1.0 (厳しい)</span>
              <span>3.0 (標準)</span>
              <span>5.0 (緩い)</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleDetectOutliers} disabled={loading}>
            {loading ? '⏳ 検出中...' : '🔍 異常値を検出'}
          </button>
        </div>

        {error && <div className="error-message">⚠️ {error}</div>}

        {/* 検出結果 */}
        {outliers !== null && (
          <div className="outlier-results">
            <div className="outlier-summary">
              <h4>検出結果サマリー</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">異常値数:</span>
                  <span className="summary-value">{outliers.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">高い値:</span>
                  <span className="summary-value">
                    {outliers.filter((o) => o.type === 'high').length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">低い値:</span>
                  <span className="summary-value">
                    {outliers.filter((o) => o.type === 'low').length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">使用σ:</span>
                  <span className="summary-value">{sigmaMul.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {outliers.length > 0 ? (
              <div className="outlier-table-container">
                <h4>異常値一覧</h4>
                <div className="table-wrapper">
                  <table className="outlier-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>距離 (m)</th>
                        <th>値 (mm)</th>
                        <th>標準偏差倍率</th>
                        <th>種別</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outliers.map((outlier, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{outlier.distance.toFixed(2)}</td>
                          <td>{outlier.value.toFixed(3)}</td>
                          <td>
                            <span
                              className="deviation-badge"
                              style={{ backgroundColor: getSeverityColor(outlier.deviation) }}
                            >
                              {outlier.deviation.toFixed(2)}σ
                            </span>
                          </td>
                          <td>
                            <span className={`type-badge type-${outlier.type}`}>
                              {outlier.type === 'high' ? '↑ 高' : '↓ 低'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="no-outliers">
                <p>✓ 異常値は検出されませんでした。</p>
                <p className="suggestion">
                  より厳しい基準で検出したい場合は、標準偏差倍率を下げてください。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default OutlierDetection
