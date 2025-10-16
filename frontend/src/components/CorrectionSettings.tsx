import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './CorrectionSettings.css'

interface CorrectionCoefficients {
  cant: number
  slack: number
}

interface CorrectionData {
  distance: number
  original: number
  cantCorrection: number
  slackCorrection: number
  totalCorrection: number
  corrected: number
}

interface CorrectionResult {
  success: boolean
  data?: CorrectionData[]
  statistics?: {
    min: number
    max: number
    avg: number
    stdDev: number
  }
  coefficients?: {
    cant: number
    slack: number
  }
  dataPoints: number
  error?: string
}

interface CorrectionSettingsProps {
  data: Array<{ distance: number; irregularity: number }>
  onCorrectionApplied?: (result: CorrectionResult) => void
  onClose?: () => void
}

const CorrectionSettings: React.FC<CorrectionSettingsProps> = ({ data, onCorrectionApplied, onClose }) => {
  const [coefficients, setCoefficients] = useState<CorrectionCoefficients>({
    cant: 0.15,
    slack: 0.08,
  })
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(true)

  const handleCoefficientChange = (type: 'cant' | 'slack', value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setCoefficients(prev => ({
        ...prev,
        [type]: numValue,
      }))
    }
  }

  const handleApplyCorrection = async () => {
    if (!data || data.length === 0) {
      setError('データが空です')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3002/api/apply-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          coefficients,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setCorrectionResult(result)
        if (onCorrectionApplied) {
          onCorrectionApplied(result)
        }
      } else {
        setError(result.error || '補正処理に失敗しました')
      }
    } catch (err) {
      console.error('Correction error:', err)
      setError('補正処理中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCoefficients({ cant: 0.15, slack: 0.08 })
    setCorrectionResult(null)
    setError(null)
  }

  // グラフ用データを準備（補正前後の比較）
  const chartData = correctionResult
    ? correctionResult.data?.map((point) => ({
        distance: point.distance,
        original: point.original,
        corrected: point.corrected,
        cantCorrection: point.cantCorrection,
        slackCorrection: point.slackCorrection,
      })) || []
    : []

  // 補正量の統計
  const correctionStats = correctionResult?.data
    ? {
        avgCantCorrection: (
          correctionResult.data.reduce((sum, d) => sum + d.cantCorrection, 0) /
          correctionResult.data.length
        ).toFixed(3),
        avgSlackCorrection: (
          correctionResult.data.reduce((sum, d) => sum + d.slackCorrection, 0) /
          correctionResult.data.length
        ).toFixed(3),
        avgTotalCorrection: (
          correctionResult.data.reduce((sum, d) => sum + d.totalCorrection, 0) /
          correctionResult.data.length
        ).toFixed(3),
        maxTotalCorrection: Math.max(
          ...correctionResult.data.map((d) => d.totalCorrection)
        ).toFixed(3),
      }
    : null

  return (
    <div className="correction-settings">
      <div className="correction-header">
        <h3>⚙️ カント・スラック補正</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="correction-content">
        {/* 補正係数入力フォーム */}
        <div className="coefficient-form">
          <h4>補正係数設定</h4>
          <div className="coefficient-grid">
            <div className="coefficient-item">
              <label htmlFor="cant-coeff">
                カント補正係数:
                <span className="recommended">(推奨: 0.15)</span>
              </label>
              <input
                id="cant-coeff"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={coefficients.cant}
                onChange={(e) => handleCoefficientChange('cant', e.target.value)}
                disabled={loading}
              />
              <span className="coefficient-range">範囲: 0.0 - 1.0</span>
            </div>

            <div className="coefficient-item">
              <label htmlFor="slack-coeff">
                スラック補正係数:
                <span className="recommended">(推奨: 0.08)</span>
              </label>
              <input
                id="slack-coeff"
                type="number"
                min="0"
                max="0.5"
                step="0.01"
                value={coefficients.slack}
                onChange={(e) => handleCoefficientChange('slack', e.target.value)}
                disabled={loading}
              />
              <span className="coefficient-range">範囲: 0.0 - 0.5</span>
            </div>
          </div>

          <div className="coefficient-actions">
            <button className="btn btn-primary" onClick={handleApplyCorrection} disabled={loading}>
              {loading ? '⏳ 補正中...' : '✨ 補正を適用'}
            </button>
            <button className="btn btn-secondary" onClick={handleReset} disabled={loading}>
              🔄 リセット
            </button>
          </div>
        </div>

        {error && <div className="error-message">⚠️ {error}</div>}

        {/* 補正結果 */}
        {correctionResult && (
          <>
            {/* 補正統計 */}
            <div className="correction-stats">
              <h4>補正統計</h4>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">平均カント補正量</span>
                  <span className="stat-value">{correctionStats?.avgCantCorrection} mm</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">平均スラック補正量</span>
                  <span className="stat-value">{correctionStats?.avgSlackCorrection} mm</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">平均総補正量</span>
                  <span className="stat-value">{correctionStats?.avgTotalCorrection} mm</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">最大総補正量</span>
                  <span className="stat-value">{correctionStats?.maxTotalCorrection} mm</span>
                </div>
              </div>
            </div>

            {/* 補正後の統計 */}
            {correctionResult.statistics && (
              <div className="corrected-statistics">
                <h4>補正後の統計値</h4>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-label">最小値</span>
                    <span className="stat-value">{correctionResult.statistics.min.toFixed(3)} mm</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">最大値</span>
                    <span className="stat-value">{correctionResult.statistics.max.toFixed(3)} mm</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">平均値</span>
                    <span className="stat-value">{correctionResult.statistics.avg.toFixed(3)} mm</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">標準偏差</span>
                    <span className="stat-value">{correctionResult.statistics.stdDev.toFixed(3)} mm</span>
                  </div>
                </div>
              </div>
            )}

            {/* 比較グラフ */}
            <div className="correction-chart">
              <div className="chart-controls">
                <h4>補正前後の比較</h4>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={showComparison}
                    onChange={(e) => setShowComparison(e.target.checked)}
                  />
                  <span>補正前データを表示</span>
                </label>
              </div>

              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="distance"
                    label={{ value: '距離 (m)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: '軌道狂い (mm)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {showComparison && (
                    <Line
                      type="monotone"
                      dataKey="original"
                      stroke="#ff7043"
                      dot={false}
                      name="補正前"
                      strokeWidth={2}
                      strokeOpacity={0.6}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="corrected"
                    stroke="#4caf50"
                    dot={false}
                    name="補正後"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* データポイント数 */}
            <div className="correction-info">
              <p>
                ✓ 処理データ点数: <strong>{correctionResult.dataPoints}</strong> points
              </p>
              <p>
                ✓ 使用係数: カント={correctionResult.coefficients?.cant.toFixed(2)}, スラック=
                {correctionResult.coefficients?.slack.toFixed(2)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CorrectionSettings
