import React, { useState } from 'react'
import './FFTFilterSettings.css'

interface FFTSettings {
  filterType: 'fft_lowpass' | 'fft_highpass' | 'fft_bandpass'
  cutoffFreq: number
  lowCutoff: number
  highCutoff: number
}

interface FFTFilterSettingsProps {
  onSettingsChange: (settings: FFTSettings) => void
  disabled?: boolean
}

const FFTFilterSettings: React.FC<FFTFilterSettingsProps> = ({ onSettingsChange, disabled }) => {
  const [filterType, setFilterType] = useState<'fft_lowpass' | 'fft_highpass' | 'fft_bandpass'>('fft_lowpass')
  const [cutoffFreq, setCutoffFreq] = useState<number>(0.1)
  const [lowCutoff, setLowCutoff] = useState<number>(0.05)
  const [highCutoff, setHighCutoff] = useState<number>(0.2)

  const handleFilterTypeChange = (type: 'fft_lowpass' | 'fft_highpass' | 'fft_bandpass') => {
    setFilterType(type)
    const settings: FFTSettings = {
      filterType: type,
      cutoffFreq,
      lowCutoff,
      highCutoff,
    }
    onSettingsChange(settings)
  }

  const handleCutoffChange = (value: number) => {
    setCutoffFreq(value)
    const settings: FFTSettings = {
      filterType,
      cutoffFreq: value,
      lowCutoff,
      highCutoff,
    }
    onSettingsChange(settings)
  }

  const handleLowCutoffChange = (value: number) => {
    setLowCutoff(value)
    const settings: FFTSettings = {
      filterType,
      cutoffFreq,
      lowCutoff: value,
      highCutoff,
    }
    onSettingsChange(settings)
  }

  const handleHighCutoffChange = (value: number) => {
    setHighCutoff(value)
    const settings: FFTSettings = {
      filterType,
      cutoffFreq,
      lowCutoff,
      highCutoff: value,
    }
    onSettingsChange(settings)
  }

  return (
    <div className="fft-filter-settings">
      <h4>🔧 FFTフィルタ詳細設定</h4>

      {/* フィルタタイプ選択 */}
      <div className="filter-type-selection">
        <label>フィルタタイプ:</label>
        <div className="filter-type-buttons">
          <button
            className={`type-btn ${filterType === 'fft_lowpass' ? 'active' : ''}`}
            onClick={() => handleFilterTypeChange('fft_lowpass')}
            disabled={disabled}
          >
            📉 ローパス
          </button>
          <button
            className={`type-btn ${filterType === 'fft_highpass' ? 'active' : ''}`}
            onClick={() => handleFilterTypeChange('fft_highpass')}
            disabled={disabled}
          >
            📈 ハイパス
          </button>
          <button
            className={`type-btn ${filterType === 'fft_bandpass' ? 'active' : ''}`}
            onClick={() => handleFilterTypeChange('fft_bandpass')}
            disabled={disabled}
          >
            📊 バンドパス
          </button>
        </div>
      </div>

      {/* カットオフ周波数設定 */}
      {(filterType === 'fft_lowpass' || filterType === 'fft_highpass') && (
        <div className="cutoff-control">
          <label htmlFor="cutoff-slider">
            カットオフ周波数: <strong>{cutoffFreq.toFixed(3)}</strong>
            <span className="frequency-hint">
              {filterType === 'fft_lowpass' ? '（この周波数以下を残す）' : '（この周波数以上を残す）'}
            </span>
          </label>
          <input
            id="cutoff-slider"
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={cutoffFreq}
            onChange={(e) => handleCutoffChange(parseFloat(e.target.value))}
            disabled={disabled}
          />
          <div className="slider-labels">
            <span>0.01 (低)</span>
            <span>0.25</span>
            <span>0.5 (高)</span>
          </div>
        </div>
      )}

      {/* バンドパスの場合の2つのカットオフ */}
      {filterType === 'fft_bandpass' && (
        <div className="bandpass-controls">
          <div className="cutoff-control">
            <label htmlFor="low-cutoff-slider">
              低周波カットオフ: <strong>{lowCutoff.toFixed(3)}</strong>
            </label>
            <input
              id="low-cutoff-slider"
              type="range"
              min="0.01"
              max="0.4"
              step="0.01"
              value={lowCutoff}
              onChange={(e) => handleLowCutoffChange(parseFloat(e.target.value))}
              disabled={disabled}
            />
            <div className="slider-labels">
              <span>0.01</span>
              <span>0.2</span>
              <span>0.4</span>
            </div>
          </div>

          <div className="cutoff-control">
            <label htmlFor="high-cutoff-slider">
              高周波カットオフ: <strong>{highCutoff.toFixed(3)}</strong>
            </label>
            <input
              id="high-cutoff-slider"
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={highCutoff}
              onChange={(e) => handleHighCutoffChange(parseFloat(e.target.value))}
              disabled={disabled}
            />
            <div className="slider-labels">
              <span>0.02</span>
              <span>0.25</span>
              <span>0.5</span>
            </div>
          </div>

          {lowCutoff >= highCutoff && (
            <div className="validation-warning">
              ⚠️ 低周波カットオフは高周波カットオフより小さい値にしてください
            </div>
          )}
        </div>
      )}

      {/* FFTフィルタの説明 */}
      <div className="fft-description">
        <h5>📖 フィルタの説明</h5>
        {filterType === 'fft_lowpass' && (
          <p>
            <strong>ローパスフィルタ:</strong> 高周波ノイズを除去し、低周波成分（緩やかな変動）を残します。
            データの平滑化に効果的です。
          </p>
        )}
        {filterType === 'fft_highpass' && (
          <p>
            <strong>ハイパスフィルタ:</strong> 低周波成分（トレンド）を除去し、高周波成分（急激な変動）を残します。
            周期的な変動の検出に効果的です。
          </p>
        )}
        {filterType === 'fft_bandpass' && (
          <p>
            <strong>バンドパスフィルタ:</strong> 指定した周波数範囲のみを残し、それ以外を除去します。
            特定の周期を持つ変動の抽出に効果的です。
          </p>
        )}
      </div>
    </div>
  )
}

export default FFTFilterSettings
