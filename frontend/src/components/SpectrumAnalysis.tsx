import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './SpectrumAnalysis.css'

interface DominantFrequency {
  frequency: number
  power: number
  index: number
}

interface SpectrumResult {
  success: boolean
  fftSize: number
  originalLength: number
  powerSpectrum: number[]
  frequencies: number[]
  dominantFrequencies: DominantFrequency[]
  totalPower: number
}

interface SpectrumAnalysisProps {
  data: Array<{ distance: number; irregularity: number }>
  onClose?: () => void
}

const SpectrumAnalysis: React.FC<SpectrumAnalysisProps> = ({ data, onClose }) => {
  const [spectrumResult, setSpectrumResult] = useState<SpectrumResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyzeSpectrum = async () => {
    if (!data || data.length === 0) {
      setError('データが空です')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3002/api/analyze-spectrum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })

      const result = await response.json()

      if (result.success) {
        setSpectrumResult(result)
      } else {
        setError(result.error || 'スペクトル分析に失敗しました')
      }
    } catch (err) {
      console.error('Spectrum analysis error:', err)
      setError('スペクトル分析中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // グラフ用データを準備
  const chartData = spectrumResult
    ? spectrumResult.frequencies.map((freq, i) => ({
        frequency: parseFloat(freq.toFixed(4)),
        power: parseFloat(spectrumResult.powerSpectrum[i].toFixed(2)),
      }))
    : []

  return (
    <div className="spectrum-analysis">
      <div className="spectrum-header">
        <h3>📊 周波数スペクトル分析</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="spectrum-content">
        {!spectrumResult && (
          <div className="spectrum-intro">
            <p>軌道データの周波数成分を分析します。</p>
            <p>FFT（高速フーリエ変換）により、どの周波数帯域に強いノイズや変動があるかを把握できます。</p>
            <button
              className="btn btn-primary"
              onClick={handleAnalyzeSpectrum}
              disabled={loading || !data || data.length === 0}
            >
              {loading ? '⏳ 分析中...' : '🔍 スペクトル分析を実行'}
            </button>
          </div>
        )}

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {spectrumResult && (
          <>
            {/* メタデータ表示 */}
            <div className="spectrum-metadata">
              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="metadata-label">FFTサイズ:</span>
                  <span className="metadata-value">{spectrumResult.fftSize}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">元データ長:</span>
                  <span className="metadata-value">{spectrumResult.originalLength}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">総パワー:</span>
                  <span className="metadata-value">{spectrumResult.totalPower.toFixed(2)}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">周波数成分数:</span>
                  <span className="metadata-value">{spectrumResult.frequencies.length}</span>
                </div>
              </div>
            </div>

            {/* パワースペクトルグラフ */}
            <div className="spectrum-chart">
              <h4>パワースペクトル</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="frequency"
                    label={{ value: '正規化周波数', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'パワー', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value: number) => value.toFixed(2)}
                    labelFormatter={(label) => `周波数: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="power"
                    stroke="#8884d8"
                    dot={false}
                    name="パワースペクトル"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 主要周波数成分テーブル */}
            <div className="dominant-frequencies">
              <h4>主要周波数成分（上位5つ）</h4>
              {spectrumResult.dominantFrequencies.length > 0 ? (
                <table className="frequency-table">
                  <thead>
                    <tr>
                      <th>順位</th>
                      <th>周波数</th>
                      <th>パワー</th>
                      <th>インデックス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spectrumResult.dominantFrequencies.map((freq, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{freq.frequency.toFixed(4)}</td>
                        <td>{freq.power.toFixed(2)}</td>
                        <td>{freq.index}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-frequencies">顕著な周波数成分は検出されませんでした。</p>
              )}
            </div>

            {/* 再実行ボタン */}
            <div className="spectrum-actions">
              <button
                className="btn btn-secondary"
                onClick={handleAnalyzeSpectrum}
                disabled={loading}
              >
                🔄 再分析
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SpectrumAnalysis
