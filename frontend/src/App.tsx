import { useState } from 'react'
import './App.css'
import SimplifiedSidebar from './components/SimplifiedSidebar'
import FileUpload from './components/FileUpload'
import ChartDisplay from './components/ChartDisplay'
import Statistics from './components/Statistics'
import FilterOptions from './components/FilterOptions'
import DualRailChart from './components/DualRailChart'
import DualRailStatistics from './components/DualRailStatistics'
import MTTResultDisplay from './components/MTTResultDisplay'
import SpectrumAnalysis from './components/SpectrumAnalysis'
import CorrectionSettings from './components/CorrectionSettings'
import OutlierDetection from './components/OutlierDetection'

// ページコンポーネント
import { WorkflowPage } from './pages/WorkflowPage'
import { AdvancedModePage } from './pages/AdvancedModePage'
import { PositionAlignmentPage } from './pages/PositionAlignmentPage'
import KiyaDataPage from './pages/KiyaDataPage'
import LegacyDataPage from './pages/LegacyDataPage'
import DataImportPage from './pages/DataImportPage'
import FileConversionPage from './pages/FileConversionPage'
import AlgorithmAnalysisPage from './pages/AlgorithmAnalysisPage'
import { RestorationWorkspacePage } from './pages/RestorationWorkspacePage'
import { CurveSpecManagementPage } from './pages/CurveSpecManagementPage'
import BatchProcessingPage from './pages/BatchProcessingPage'
import TrackEnvironmentPage from './pages/TrackEnvironmentPage'
import EccentricVersinePage from './pages/EccentricVersinePage'
import { WorkSectionPage } from './pages/WorkSectionPage'
import { MTTSettingsPage } from './pages/MTTSettingsPage'
import { FixedPointPage } from './pages/FixedPointPage'
import { MovementLimitPage } from './pages/MovementLimitPage'
import { BeforeAfterPage } from './pages/BeforeAfterPage'
import { PlanLinePage } from './pages/PlanLinePage'
import { VerticalCurvePage } from './pages/VerticalCurvePage'
import { FieldMeasurementPage } from './pages/FieldMeasurementPage'
import { MovementCalcPage } from './pages/MovementCalcPage'
import { WavebandAnalysisPage } from './pages/WavebandAnalysisPage'
import { QualityAnalysisPage } from './pages/QualityAnalysisPage'
import { ExportALSPage } from './pages/ExportALSPage'
import { ExportMJPage } from './pages/ExportMJPage'
import { ExportALCPage } from './pages/ExportALCPage'
import { ExportGeneralPage } from './pages/ExportGeneralPage'
import { ReportPage } from './pages/ReportPage'
import { DashboardPage } from './pages/DashboardPage'
import { GlobalWorkspaceProvider } from './contexts/GlobalWorkspaceContext'

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

export interface DualRailDataSet {
  leftRail: DataSet
  rightRail: DataSet
  filename?: string
}

// 統計値を計算するヘルパー関数
function calculateStatistics(data: TrackData[]) {
  if (!data || data.length === 0) {
    return { min: 0, max: 0, avg: 0, stdDev: 0 }
  }

  const values = data.map(d => d.irregularity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length

  const variance = values.reduce((sum, val) =>
    sum + Math.pow(val - avg, 2), 0
  ) / values.length
  const stdDev = Math.sqrt(variance)

  return { min, max, avg, stdDev }
}

function App() {
  // ページ切り替え - デフォルトをワークフローに設定
  const [currentPage, setCurrentPage] = useState<string>('workflow')

  // サイドバーの開閉状態
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // モード切り替え: 'single' = 単一レール, 'dual' = 左右レール別
  const [railMode, setRailMode] = useState<'single' | 'dual'>('single')

  // 単一レールデータ
  const [originalData, setOriginalData] = useState<DataSet | null>(null)
  const [restoredData, setRestoredData] = useState<DataSet | null>(null)

  // 左右レール別データ
  const [dualRailData, setDualRailData] = useState<DualRailDataSet | null>(null)
  const [dualRailRestored, setDualRailRestored] = useState<DualRailDataSet | null>(null)

  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('moving_average_3')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [peaks, setPeaks] = useState<any>(null)
  const [mttResult, setMttResult] = useState<any>(null)

  // 左右レール表示切り替え
  const [showLeft, setShowLeft] = useState(true)
  const [showRight, setShowRight] = useState(true)

  // 新機能のState
  const [outliers, setOutliers] = useState<any>(null)
  const [advancedTab, setAdvancedTab] = useState<string>('peaks') // peaks, spectrum, correction, outliers

  // データがあるかチェック
  const hasData = (railMode === 'single' && originalData) || (railMode === 'dual' && dualRailData)

  // ========== ハンドラー関数 ==========

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const endpoint = railMode === 'dual' ? '/api/upload-dual-rail' : '/api/upload'

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        if (railMode === 'dual') {
          setDualRailData({
            leftRail: {
              data: result.leftRail.data,
              statistics: result.leftRail.statistics,
              filename: result.filename + ' (左レール)'
            },
            rightRail: {
              data: result.rightRail.data,
              statistics: result.rightRail.statistics,
              filename: result.filename + ' (右レール)'
            },
            filename: result.filename
          })
          setDualRailRestored(null)
        } else {
          setOriginalData({
            data: result.data,
            statistics: result.statistics,
            filename: result.filename
          })
          setRestoredData(null)
        }
        setPeaks(null)
        setMttResult(null)
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

  const handleApplyFilter = async () => {
    if (railMode === 'single' && !originalData) return
    if (railMode === 'dual' && !dualRailData) return

    setLoading(true)
    try {
      if (railMode === 'dual' && dualRailData) {
        // 左右レール別にフィルタを適用
        const [leftResponse, rightResponse] = await Promise.all([
          fetch('/api/apply-filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: dualRailData.leftRail.data,
              filterType: filterType,
              options: {}
            }),
          }),
          fetch('/api/apply-filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: dualRailData.rightRail.data,
              filterType: filterType,
              options: {}
            }),
          })
        ])

        const leftResult = await leftResponse.json()
        const rightResult = await rightResponse.json()

        console.log('Left filter result:', leftResult)
        console.log('Right filter result:', rightResult)

        if (leftResult.success && rightResult.success) {
          console.log('Left data length:', leftResult.data?.length)
          console.log('Right data length:', rightResult.data?.length)

          const leftStats = calculateStatistics(leftResult.data)
          const rightStats = calculateStatistics(rightResult.data)

          console.log('Left stats:', leftStats)
          console.log('Right stats:', rightStats)

          setDualRailRestored({
            leftRail: {
              data: leftResult.data,
              statistics: leftStats,
              filename: `${dualRailData.filename} (左レール - ${filterType})`
            },
            rightRail: {
              data: rightResult.data,
              statistics: rightStats,
              filename: `${dualRailData.filename} (右レール - ${filterType})`
            },
            filename: dualRailData.filename
          })
          alert('フィルタ処理が完了しました')
        } else {
          alert('エラー: フィルタ処理に失敗しました')
        }
      } else if (originalData) {
        // 単一レール
        const response = await fetch('/api/apply-filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: originalData.data,
            filterType: filterType,
            options: {}
          }),
        })

        const result = await response.json()

        if (result.success) {
          setRestoredData({
            data: result.data,
            statistics: calculateStatistics(result.data),
            filename: `${originalData.filename} (${filterType})`
          })
          alert('フィルタ処理が完了しました')
        } else {
          alert('エラー: ' + (result.error || '不明なエラー'))
        }
      }
    } catch (error) {
      console.error('Filter error:', error)
      alert('フィルタ処理エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDetectPeaks = async () => {
    if (railMode === 'single' && !originalData) return
    if (railMode === 'dual' && !dualRailData) return

    setLoading(true)
    try {
      if (railMode === 'dual' && dualRailData) {
        // 左右レール別にピーク検出
        const [leftResponse, rightResponse] = await Promise.all([
          fetch('/api/detect-peaks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: dualRailData.leftRail.data,
              options: { threshold: 2.0, minDistance: 5 }
            }),
          }),
          fetch('/api/detect-peaks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: dualRailData.rightRail.data,
              options: { threshold: 2.0, minDistance: 5 }
            }),
          })
        ])

        const leftResult = await leftResponse.json()
        const rightResult = await rightResponse.json()

        if (leftResult.success && rightResult.success) {
          setPeaks({
            leftPeaks: leftResult.peaks,
            rightPeaks: rightResult.peaks,
            summary: {
              left: leftResult.summary?.totalPeaks || 0,
              right: rightResult.summary?.totalPeaks || 0,
              total: (leftResult.summary?.totalPeaks || 0) + (rightResult.summary?.totalPeaks || 0)
            }
          })
          alert(`左: ${leftResult.summary?.totalPeaks || 0}個、右: ${rightResult.summary?.totalPeaks || 0}個のピークを検出しました`)
        } else {
          alert('エラー: ピーク検出に失敗しました')
        }
      } else if (originalData) {
        // 単一レール
        const response = await fetch('/api/detect-peaks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: originalData.data,
            options: { threshold: 2.0, minDistance: 5 }
          }),
        })

        const result = await response.json()

        if (result.success) {
          setPeaks(result.peaks)
          alert(`${result.summary?.totalPeaks || 0}個のピークを検出しました`)
        } else {
          alert('エラー: ' + (result.error || '不明なエラー'))
        }
      }
    } catch (error) {
      console.error('Peak detection error:', error)
      alert('ピーク検出エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCalculateMTT = async () => {
    if (railMode === 'single' && !originalData) return
    if (railMode === 'dual' && !dualRailData) return

    setLoading(true)
    try {
      if (railMode === 'dual' && dualRailData) {
        // 左右レール別MTT計算
        const response = await fetch('/api/calculate-dual-mtt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leftRail: dualRailData.leftRail.data,
            rightRail: dualRailData.rightRail.data,
            params: {
              thresholds: {
                bcThreshold: 15.0,
                cdThreshold: 30.0
              }
            }
          }),
        })

        const result = await response.json()

        if (result.success) {
          setMttResult(result)
          alert('左右レール別MTT値計算が完了しました')
        } else {
          alert('エラー: ' + (result.error || '不明なエラー'))
        }
      } else if (originalData) {
        // 単一レールMTT計算
        const response = await fetch('/api/calculate-mtt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: originalData.data,
            params: {
              thresholds: {
                bcThreshold: 15.0,
                cdThreshold: 30.0
              }
            }
          }),
        })

        const result = await response.json()

        if (result.success) {
          setMttResult(result)
          alert('MTT値計算が完了しました')
        } else {
          alert('エラー: ' + (result.error || '不明なエラー'))
        }
      }
    } catch (error) {
      console.error('MTT calculation error:', error)
      alert('MTT値計算エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async (format: string) => {
    if (railMode === 'single' && !originalData) return
    if (railMode === 'dual' && !dualRailData) return

    setLoading(true)
    try {
      let dataToExport
      if (railMode === 'dual' && dualRailData) {
        // 左右レール別データの結合
        dataToExport = [
          ...dualRailData.leftRail.data.map(d => ({ ...d, rail: 'left' })),
          ...dualRailData.rightRail.data.map(d => ({ ...d, rail: 'right' }))
        ]
      } else {
        dataToExport = restoredData?.data || originalData?.data || []
      }

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataToExport,
          format: format,
          options: {
            includeStatistics: true,
            includePeaks: peaks !== null,
            peaks: peaks
          }
        }),
      })

      if (format === 'json') {
        const result = await response.json()
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `track_data_${Date.now()}.json`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `track_data_${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
        a.click()
        window.URL.revokeObjectURL(url)
      }

      alert(`${format.toUpperCase()}形式でエクスポートしました`)
    } catch (error) {
      console.error('Export error:', error)
      alert('エクスポートエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // ========== JSXレンダー ==========

  return (
    <GlobalWorkspaceProvider>
      <div className="App">
        {/* サイドバー */}
        <SimplifiedSidebar
          activeTab={currentPage}
          onTabChange={setCurrentPage}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* メインコンテンツエリア */}
        <div className="app-with-sidebar">
      {/* 統合ダッシュボード */}
      {currentPage === 'dashboard' && (
        <DashboardPage />
      )}

      {/* メインワークフロー画面 */}
      {currentPage === 'workflow' && (
        <WorkflowPage />
      )}

      {/* 上級者向け個別処理モード */}
      {currentPage === 'advanced-mode' && (
        <AdvancedModePage onNavigate={setCurrentPage} />
      )}

      {/* 位置合わせページ */}
      {currentPage === 'position-alignment' && (
        <PositionAlignmentPage />
      )}

      {/* データインポートページ */}
      {currentPage === 'import' && (
        <DataImportPage />
      )}

      {/* ファイル形式変換ページ */}
      {currentPage === 'conversion' && (
        <FileConversionPage />
      )}

      {/* アルゴリズム解析ページ */}
      {currentPage === 'algorithm' && (
        <AlgorithmAnalysisPage />
      )}

      {/* 復元整正ワークスペースページ */}
      {currentPage === 'restoration' && (
        <RestorationWorkspacePage />
      )}

      {/* 曲線諸元管理ページ */}
      {currentPage === 'curve-spec' && (
        <CurveSpecManagementPage />
      )}

      {/* バッチ処理ページ */}
      {currentPage === 'batch' && (
        <BatchProcessingPage />
      )}

      {/* キヤデータページ */}
      {currentPage === 'kiya-import' && (
        <KiyaDataPage />
      )}

      {/* 軌道環境データページ */}
      {currentPage === 'environment' && (
        <TrackEnvironmentPage />
      )}

      {/* 偏心矢計算ページ */}
      {currentPage === 'eccentric' && (
        <EccentricVersinePage />
      )}

      {/* 旧ラボデータページ */}
      {currentPage === 'legacy' && (
        <LegacyDataPage />
      )}

      {/* 作業区間設定ページ */}
      {currentPage === 'work-section' && (
        <WorkSectionPage />
      )}

      {/* MTT設定ページ */}
      {currentPage === 'mtt-settings' && (
        <MTTSettingsPage />
      )}

      {/* 固定点設定ページ */}
      {currentPage === 'fixed-point' && (
        <FixedPointPage />
      )}

      {/* 移動量制限ページ */}
      {currentPage === 'movement-limit' && (
        <MovementLimitPage />
      )}

      {/* 整備前後比較ページ */}
      {currentPage === 'before-after' && (
        <BeforeAfterPage />
      )}

      {/* 計画線設定ページ */}
      {currentPage === 'plan-line' && (
        <PlanLinePage />
      )}

      {/* 縦曲線設定ページ */}
      {currentPage === 'vertical-curve' && (
        <VerticalCurvePage />
      )}

      {/* 手検測入力ページ */}
      {currentPage === 'field-measurement' && (
        <FieldMeasurementPage />
      )}

      {/* 移動量算出ページ */}
      {currentPage === 'movement-calc' && (
        <MovementCalcPage />
      )}

      {/* FFT解析ページ */}
      {currentPage === 'waveband-analysis' && (
        <WavebandAnalysisPage />
      )}

      {/* σ値・良化率解析ページ */}
      {currentPage === 'quality-analysis' && (
        <QualityAnalysisPage />
      )}

      {/* ALS出力ページ */}
      {currentPage === 'export-als' && (
        <ExportALSPage />
      )}

      {/* MJ出力ページ */}
      {currentPage === 'export-mj' && (
        <ExportMJPage />
      )}

      {/* ALC出力ページ */}
      {currentPage === 'export-alc' && (
        <ExportALCPage />
      )}

      {/* 汎用出力ページ */}
      {currentPage === 'export-general' && (
        <ExportGeneralPage />
      )}

      {/* 成果表作成ページ */}
      {currentPage === 'report' && (
        <ReportPage />
      )}

      {/* メインページ（軌道データ解析） */}
      {currentPage === 'analysis' && (
      <div className="container">
        {/* モード切り替えセクション */}
        <section className="mode-selector">
          <h2>📋 データ形式選択</h2>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${railMode === 'single' ? 'active' : ''}`}
              onClick={() => {
                setRailMode('single')
                setDualRailData(null)
                setDualRailRestored(null)
                setOriginalData(null)
                setRestoredData(null)
                setPeaks(null)
                setMttResult(null)
              }}
              disabled={loading}
            >
              🚂 単一レール<br/><span style={{ fontSize: '0.8rem' }}>(distance, irregularity)</span>
            </button>
            <button
              className={`mode-btn ${railMode === 'dual' ? 'active' : ''}`}
              onClick={() => {
                setRailMode('dual')
                setOriginalData(null)
                setRestoredData(null)
                setDualRailData(null)
                setDualRailRestored(null)
                setPeaks(null)
                setMttResult(null)
              }}
              disabled={loading}
            >
              🚃 左右レール別<br/><span style={{ fontSize: '0.8rem' }}>(distance, left, right)</span>
            </button>
          </div>
        </section>

        {/* アップロードセクション */}
        <section className="upload-section">
          <h2>📤 データアップロード</h2>
          <FileUpload onFileUpload={handleFileUpload} loading={loading} />

          {/* 単一レール情報 */}
          {railMode === 'single' && originalData && (
            <div className="info">
              <p>✓ ファイル: <strong>{originalData.filename}</strong></p>
              <p>✓ データ点数: <strong>{originalData.data.length}</strong> points</p>
            </div>
          )}

          {/* 左右レール情報 */}
          {railMode === 'dual' && dualRailData && (
            <div className="info">
              <p>✓ ファイル: <strong>{dualRailData.filename}</strong></p>
              <p>✓ 左レール: <strong>{dualRailData.leftRail.data.length}</strong> points</p>
              <p>✓ 右レール: <strong>{dualRailData.rightRail.data.length}</strong> points</p>

              {/* 左右表示切り替えコントロール */}
              <div className="rail-visibility-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={showLeft}
                    onChange={(e) => setShowLeft(e.target.checked)}
                  />
                  <span className="left-label">👈 左レール表示</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showRight}
                    onChange={(e) => setShowRight(e.target.checked)}
                  />
                  <span className="right-label">右レール 👉</span>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* グラフと統計セクション */}
        {hasData && (
          <>
            {/* 単一レール表示 */}
            {railMode === 'single' && originalData && (
              <>
                <section className="chart-section">
                  <h2>📊 軌道波形データ</h2>
                  <ChartDisplay
                    originalData={originalData.data}
                    restoredData={restoredData?.data}
                    peaks={peaks?.maxima && peaks?.minima ? [...peaks.maxima, ...peaks.minima] : undefined}
                    outliers={outliers}
                  />
                </section>

                <section className="stats-section">
                  <h2>📈 統計情報</h2>
                  <div className="stats-grid">
                    <Statistics
                      title="元データ (Original)"
                      statistics={originalData.statistics}
                    />
                    {restoredData && (
                      <Statistics
                        title="復元データ (Restored)"
                        statistics={restoredData.statistics}
                      />
                    )}
                  </div>
                </section>
              </>
            )}

            {/* 左右レール表示 */}
            {railMode === 'dual' && dualRailData && (
              <>
                <section className="chart-section">
                  <h2>📊 左右レール別軌道波形データ</h2>
                  <DualRailChart
                    leftRail={dualRailData.leftRail.data}
                    rightRail={dualRailData.rightRail.data}
                    leftRailRestored={dualRailRestored?.leftRail.data}
                    rightRailRestored={dualRailRestored?.rightRail.data}
                    showLeft={showLeft}
                    showRight={showRight}
                    peaks={peaks}
                  />
                </section>

                <section className="stats-section">
                  <h2>📈 統計情報</h2>

                  {/* 元データの統計 */}
                  <div className="stats-group">
                    <h3>元データ (Original)</h3>
                    <DualRailStatistics
                      leftRail={dualRailData.leftRail.statistics}
                      rightRail={dualRailData.rightRail.statistics}
                      showComparison={true}
                    />
                  </div>

                  {/* 復元データの統計 */}
                  {dualRailRestored && (
                    <div className="stats-group">
                      <h3>復元データ (Restored)</h3>
                      <DualRailStatistics
                        leftRail={dualRailRestored.leftRail.statistics}
                        rightRail={dualRailRestored.rightRail.statistics}
                        showComparison={true}
                      />
                    </div>
                  )}
                </section>
              </>
            )}

            {/* フィルタセクション */}
            <section className="filter-section">
              <h2>🔧 フィルタ処理</h2>
              <FilterOptions
                filterType={filterType}
                onFilterChange={setFilterType}
                disabled={loading}
              />


              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={handleApplyFilter}
                  disabled={loading}
                >
                  {loading ? '⏳ 処理中...' : '✨ フィルタを適用'}
                </button>
              </div>
            </section>

            {/* 高度な分析セクション */}
            <section className="advanced-section">
              <h2>
                🔬 高度な分析
                <button
                  className="btn btn-link"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? '▼ 閉じる' : '▶ 開く'}
                </button>
              </h2>

              {showAdvanced && (
                <div className="advanced-content">
                  {/* タブナビゲーション */}
                  <div className="advanced-tabs">
                    <button
                      className={`tab-btn ${advancedTab === 'peaks' ? 'active' : ''}`}
                      onClick={() => setAdvancedTab('peaks')}
                    >
                      📍 ピーク検出
                    </button>
                    <button
                      className={`tab-btn ${advancedTab === 'outliers' ? 'active' : ''}`}
                      onClick={() => setAdvancedTab('outliers')}
                    >
                      🚨 異常値検出
                    </button>
                    <button
                      className={`tab-btn ${advancedTab === 'spectrum' ? 'active' : ''}`}
                      onClick={() => setAdvancedTab('spectrum')}
                    >
                      📊 スペクトル分析
                    </button>
                    <button
                      className={`tab-btn ${advancedTab === 'correction' ? 'active' : ''}`}
                      onClick={() => setAdvancedTab('correction')}
                    >
                      ⚙️ カント・スラック補正
                    </button>
                    <button
                      className={`tab-btn ${advancedTab === 'mtt' ? 'active' : ''}`}
                      onClick={() => setAdvancedTab('mtt')}
                    >
                      📊 MTT値計算
                    </button>
                    <button
                      className={`tab-btn ${advancedTab === 'export' ? 'active' : ''}`}
                      onClick={() => setAdvancedTab('export')}
                    >
                      💾 エクスポート
                    </button>
                  </div>

                  {/* タブコンテンツ */}
                  {advancedTab === 'peaks' && (
                    <div className="tab-content">
                      <h3>📍 ピーク検出</h3>
                      <p>軌道狂いのピーク箇所を検出します</p>
                      <button
                        className="btn btn-primary"
                        onClick={handleDetectPeaks}
                        disabled={loading}
                      >
                        ピークを検出
                      </button>
                      {peaks && (
                        <div className="result-info">
                          {railMode === 'dual' ? (
                            <>
                              👈 左: <strong>{peaks.summary?.left || 0}</strong>箇所<br />
                              右 👉: <strong>{peaks.summary?.right || 0}</strong>箇所<br />
                              <span style={{ fontSize: '0.9rem', color: '#666' }}>計: {peaks.summary?.total || 0}箇所</span>
                            </>
                          ) : (
                            <>検出数: <strong>{peaks.totalPeaks || 0}</strong>箇所</>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {advancedTab === 'outliers' && (
                    <div className="tab-content">
                      <OutlierDetection
                        data={railMode === 'single' ? originalData?.data || [] : dualRailData?.leftRail.data || []}
                        onOutliersDetected={setOutliers}
                      />
                    </div>
                  )}

                  {advancedTab === 'spectrum' && (
                    <div className="tab-content">
                      <SpectrumAnalysis
                        data={railMode === 'single' ? originalData?.data || [] : dualRailData?.leftRail.data || []}
                      />
                    </div>
                  )}

                  {advancedTab === 'correction' && (
                    <div className="tab-content">
                      <CorrectionSettings
                        data={railMode === 'single' ? originalData?.data || [] : dualRailData?.leftRail.data || []}
                      />
                    </div>
                  )}

                  {advancedTab === 'mtt' && (
                    <div className="tab-content">
                      <h3>📊 MTT値計算</h3>
                      <p>軌道の総合評価指標を計算します</p>
                      <button
                        className="btn btn-primary"
                        onClick={handleCalculateMTT}
                        disabled={loading}
                      >
                        MTT値を計算
                      </button>
                      {mttResult && (
                        <div className="result-info">
                          {railMode === 'dual' ? (
                            <>
                              ✓ 計算完了<br />
                              <span style={{ fontSize: '0.85rem' }}>左右レール別の結果を表示中</span>
                            </>
                          ) : (
                            <>✓ 計算完了</>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {advancedTab === 'export' && (
                    <div className="tab-content">
                      <h3>💾 データエクスポート</h3>
                      <p>処理結果をファイルに出力します</p>
                      <div className="export-buttons">
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleExportData('excel')}
                          disabled={loading}
                        >
                          📊 Excel出力
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleExportData('csv')}
                          disabled={loading}
                        >
                          📝 CSV出力
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleExportData('json')}
                          disabled={loading}
                        >
                          🔗 JSON出力
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MTT結果表示 */}
                  {mttResult && (
                    <div className="mtt-results">
                      {railMode === 'dual' ? (
                        <>
                          <h3>📊 左右レール別MTT値計算結果</h3>
                          <div className="dual-mtt-grid">
                            {mttResult.leftRail && (
                              <div className="mtt-rail-section">
                                <h4>👈 左レール</h4>
                                <MTTResultDisplay result={mttResult.leftRail} showDetailedTable={false} />
                              </div>
                            )}
                            {mttResult.rightRail && (
                              <div className="mtt-rail-section">
                                <h4>右レール 👉</h4>
                                <MTTResultDisplay result={mttResult.rightRail} showDetailedTable={false} />
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <h3>📊 MTT値計算結果</h3>
                          <MTTResultDisplay result={mttResult} showDetailedTable={true} maxRowsToShow={15} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* 空状態 */}
        {!hasData && (
          <div className="empty-state">
            <p>📊 CSVファイルをアップロードしてください</p>
            <div className="format-examples">
              <div className="format-example">
                <h4>📋 単一レール形式</h4>
                <code>距離(m),軌道狂い量(mm)<br />
0.0,2.5<br />
0.1,2.8<br />
0.2,3.1<br />
0.3,2.9</code>
              </div>
              <div className="format-example">
                <h4>📋 左右レール別形式</h4>
                <code>距離(m),左レール(mm),右レール(mm)<br />
0.0,2.5,2.3<br />
0.1,2.8,2.6<br />
0.2,3.1,2.9<br />
0.3,2.9,2.7</code>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

        <footer className="footer">
          <p>🚄 Based on Rail Track Restoration System (VB6 legacy)</p>
          <p>API: Express.js | Frontend: React + TypeScript | 左右レール別対応版</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#999' }}>v2.1 - Kiya Data Analysis Enabled</p>
        </footer>
      </div>
    </div>
    </GlobalWorkspaceProvider>
  )
}

export default App
