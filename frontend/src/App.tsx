import React, { useState } from 'react'
import './App.css'
import FileUpload from './components/FileUpload'
import ChartDisplay from './components/ChartDisplay'
import Statistics from './components/Statistics'

export interface TrackData {
  distance: number
  irregularity: number
}

export interface DataSet {
  data: TrackData[]
  statistics: {
    min: number
    max: number
    avg: number
    stdDev: number
  }
  filename?: string
}

function App() {
  const [originalData, setOriginalData] = useState<DataSet | null>(null)
  const [restoredData, setRestoredData] = useState<DataSet | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setOriginalData({
          data: result.data,
          statistics: result.statistics,
          filename: result.filename
        })
        setRestoredData(null) // Clear previous restored data
      } else {
        alert('エラー: ' + (result.error || '不明なエラー'))
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('アップロードエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreWaveform = async () => {
    if (!originalData) return

    setLoading(true)
    try {
      const response = await fetch('/api/restore-waveform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: originalData.data,
          filterType: 'simple'
        }),
      })

      const result = await response.json()

      if (result.success) {
        setRestoredData({
          data: result.restored.data,
          statistics: result.restored.statistics,
          filename: originalData.filename + ' (復元)'
        })
      } else {
        alert('エラー: ' + (result.error || '不明なエラー'))
      }
    } catch (error) {
      console.error('Restore error:', error)
      alert('波形復元エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="App">
      <header className="header">
        <h1>🚄 軌道復元システム</h1>
        <p>Rail Track Restoration System</p>
      </header>

      <div className="container">
        <section className="upload-section">
          <h2>データアップロード</h2>
          <FileUpload onFileUpload={handleFileUpload} loading={loading} />
          {originalData && (
            <div className="info">
              <p>✓ ファイル: <strong>{originalData.filename}</strong></p>
              <p>✓ データ点数: <strong>{originalData.data.length}</strong> points</p>
            </div>
          )}
        </section>

        {originalData && (
          <>
            <section className="chart-section">
              <h2>軌道波形データ</h2>
              <ChartDisplay
                originalData={originalData.data}
                restoredData={restoredData?.data}
              />
            </section>

            <section className="stats-section">
              <h2>統計情報</h2>
              <div className="stats-grid">
                <Statistics
                  title="元データ"
                  statistics={originalData.statistics}
                />
                {restoredData && (
                  <Statistics
                    title="復元データ"
                    statistics={restoredData.statistics}
                  />
                )}
              </div>
            </section>

            <section className="actions-section">
              <button
                className="btn btn-primary"
                onClick={handleRestoreWaveform}
                disabled={loading}
              >
                {loading ? '処理中...' : '波形を復元'}
              </button>
              <p className="note">
                ※ 簡易的な移動平均フィルタを適用して波形を復元します
              </p>
            </section>
          </>
        )}

        {!originalData && (
          <div className="empty-state">
            <p>📊 CSVファイルをアップロードしてください</p>
            <p className="note">
              フォーマット: 距離(m), 軌道狂い量(mm)<br />
              例: 0.0, 2.5
            </p>
          </div>
        )}
      </div>

      <footer className="footer">
        <p>Based on Rail Track Restoration System (VB6 legacy)</p>
        <p>API: Express.js | Frontend: React + TypeScript</p>
      </footer>
    </div>
  )
}

export default App