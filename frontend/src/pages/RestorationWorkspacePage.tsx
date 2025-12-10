import React, { useState } from 'react';
import axios from 'axios';
import { WaveformChart } from '../components/WaveformChart';
import { InteractivePlanLineEditor } from '../components/InteractivePlanLineEditor';
import { PresetButtons, StandardButton } from '../components/StandardButton';

interface CurveSpec {
  startKP: number;
  endKP: number;
  curveType: 'straight' | 'transition' | 'circular';
  radius?: number;
  cant?: number;
  direction?: 'left' | 'right';
  label?: string;
  length?: number;
}

export const RestorationWorkspacePage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [restorationResult, setRestorationResult] = useState<any>(null);
  const [planLine, setPlanLine] = useState<number[] | null>(null);
  const [movementResult, setMovementResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [dataType, setDataType] = useState<string>('alignment');
  const [lambdaLower, setLambdaLower] = useState<number>(6.0);
  const [lambdaUpper, setLambdaUpper] = useState<number>(100.0);

  // 曲線諸元データ管理
  const [curveSpecs, setCurveSpecs] = useState<CurveSpec[]>([]);
  const [curveSpecFile, setCurveSpecFile] = useState<File | null>(null);
  const [useCurveSpecs, setUseCurveSpecs] = useState<boolean>(false);
  const [curveSpecSummary, setCurveSpecSummary] = useState<any>(null);
  const [curveSectionStats, setCurveSectionStats] = useState<any>(null);

  // 曲線諸元CSVインポート
  const handleImportCurveSpecs = async () => {
    if (!curveSpecFile) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', curveSpecFile);

      const response = await axios.post('http://localhost:3002/api/curve-spec/import', formData);

      if (response.data.success) {
        setCurveSpecs(response.data.curveSpecs);
        setCurveSpecSummary(response.data.summary);
        setUseCurveSpecs(true);
        alert(`✓ ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('Curve spec import error:', error);
      alert('曲線諸元インポートエラー: ' + (error.response?.data?.error || error.message));
    }

    setLoading(false);
  };

  // APIから曲線諸元を取得
  const handleLoadCurveSpecsFromAPI = async () => {
    setLoading(true);

    try {
      const response = await axios.get('http://localhost:3002/api/curve-spec/list');

      if (response.data.success && response.data.curveSpecs.length > 0) {
        setCurveSpecs(response.data.curveSpecs);
        setCurveSpecSummary(response.data.summary);
        setUseCurveSpecs(true);
        alert(`✓ ${response.data.curveSpecs.length}件の曲線諸元を読み込みました`);
      } else {
        alert('曲線諸元データが登録されていません');
      }
    } catch (error: any) {
      console.error('Curve spec load error:', error);
      alert('曲線諸元読み込みエラー: ' + (error.response?.data?.error || error.message));
    }

    setLoading(false);
  };

  // 曲線諸元をクリア
  const handleClearCurveSpecs = () => {
    setCurveSpecs([]);
    setCurveSpecFile(null);
    setCurveSpecSummary(null);
    setUseCurveSpecs(false);
  };

  // 曲線諸元から計画線を自動生成
  const handleAutoGeneratePlanFromCurves = async () => {
    if (!restorationResult || curveSpecs.length === 0) return;
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3002/api/restoration/vb6/auto-plan-from-curves', {
        restoredWaveform: restorationResult.restoredWaveform,
        curveSpecs,
        dataInterval: 0.25,
        startKP: 0
      });

      if (response.data.success) {
        setPlanLine(response.data.planLine);
        alert(`✓ ${response.data.message}\n\n統計情報:\n最小値: ${response.data.statistics.min.toFixed(2)}mm\n最大値: ${response.data.statistics.max.toFixed(2)}mm\n平均値: ${response.data.statistics.mean.toFixed(2)}mm`);

        // 移動量を再計算
        await handlePlanLineChange(response.data.planLine);
      }
    } catch (error: any) {
      console.error('Auto plan generation error:', error);
      alert('自動計画線生成エラー: ' + (error.response?.data?.error || error.message));
    }

    setLoading(false);
  };

  // 曲線区間ごとの統計分析
  const handleCalculateCurveSectionStats = async () => {
    if (!restorationResult || curveSpecs.length === 0) return;
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3002/api/restoration/vb6/curve-section-statistics', {
        restoredWaveform: restorationResult.restoredWaveform,
        movement: movementResult?.movement,
        curveSpecs,
        dataInterval: 0.25,
        startKP: 0
      });

      if (response.data.success) {
        setCurveSectionStats(response.data);
        alert(`✓ ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('Curve section statistics error:', error);
      alert('曲線区間統計分析エラー: ' + (error.response?.data?.error || error.message));
    }

    setLoading(false);
  };

  // 曲線諸元レポート生成
  const handleGenerateCurveReport = async (reportType: string) => {
    if (!restorationResult) return;
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3002/api/restoration/vb6/generate-curve-report', {
        restoredWaveform: restorationResult.restoredWaveform,
        planLine: planLine || [],
        movement: movementResult?.movement || [],
        curveSpecs: curveSpecs.length > 0 ? curveSpecs : undefined,
        curveSectionStats: curveSectionStats,
        dataInterval: 0.25,
        startKP: 0,
        reportType
      }, {
        responseType: 'blob'
      });

      // CSVファイルをダウンロード
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `curve_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('✓ レポートをダウンロードしました');
    } catch (error: any) {
      console.error('Report generation error:', error);
      alert('レポート生成エラー: ' + (error.response?.data?.error || error.message));
    }

    setLoading(false);
  };

  // 復元波形計算
  const handleCalculateRestoration = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('http://localhost:3002/api/upload', formData);

      const response = await axios.post('http://localhost:3002/api/restoration/vb6/calculate', {
        measurementData: uploadRes.data.data,
        filterParams: {
          lambdaLower,
          lambdaUpper,
          dataInterval: 0.25,
          dataType
        }
      });

      setRestorationResult(response.data);

      // 初期計画線を移動平均で生成
      const planLineResponse = await axios.post('http://localhost:3002/api/restoration/generate-plan-line', {
        restoredWaveform: response.data.restoredWaveform,
        windowSize: 800
      });

      if (planLineResponse.data.success) {
        setPlanLine(planLineResponse.data.planLine);
      } else {
        // フォールバック: 0mm直線
        const initialPlan = new Array(response.data.restoredWaveform.length).fill(0);
        setPlanLine(initialPlan);
      }

    } catch (error) {
      console.error(error);
      alert('復元波形計算エラーが発生しました');
    }

    setLoading(false);
  };

  // 計画線変更時の移動量再計算
  const handlePlanLineChange = async (newPlanLine: number[]) => {
    if (!restorationResult) return;

    setPlanLine(newPlanLine);

    try {
      const response = await axios.post('http://localhost:3002/api/restoration/vb6/movement', {
        restoredWaveform: restorationResult.restoredWaveform,
        planLine: newPlanLine,
        restrictions: {
          standard: 30,
          maximum: 50
        }
      });

      setMovementResult(response.data);
    } catch (error) {
      console.error('移動量計算エラー:', error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
      padding: '24px'
    }}>
      {/* ヘッダー */}
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto 24px auto',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: 700, color: '#1f2937' }}>
          復元波形整正ワークスペース
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: '#6b7280' }}>
          VB6 KCDW相当 - 復元波形計算・計画線編集・移動量算出
        </p>
      </div>

      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* 曲線諸元データ読み込みセクション */}
        {!restorationResult && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            border: '2px solid #e0f2fe'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>曲線諸元データ（オプション）</h3>

            {/* 曲線諸元が読み込まれている場合 */}
            {curveSpecs.length > 0 && (
              <div style={{
                background: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '8px' }}>
                      ✓ 曲線諸元データ読み込み済み
                    </div>
                    {curveSpecSummary && (
                      <div style={{ fontSize: '14px', color: '#065f46' }}>
                        合計 {curveSpecSummary.totalCurves} 区間
                        （直線: {curveSpecSummary.straightCount}、
                        緩和曲線: {curveSpecSummary.transitionCount}、
                        円曲線: {curveSpecSummary.circularCount}）
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={useCurveSpecs}
                        onChange={(e) => setUseCurveSpecs(e.target.checked)}
                        style={{ marginRight: '8px', width: '18px', height: '18px' }}
                      />
                      <span style={{ fontWeight: 600, color: '#065f46' }}>波形チャートに表示</span>
                    </label>
                  </div>
                </div>
                <StandardButton
                  onClick={handleClearCurveSpecs}
                  label="曲線諸元をクリア"
                  type="danger"
                  size="small"
                  style={{ marginTop: '12px' }}
                />
              </div>
            )}

            {/* 曲線諸元が読み込まれていない場合 */}
            {curveSpecs.length === 0 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* CSVファイルからインポート */}
                  <div style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                      CSVファイルからインポート
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCurveSpecFile(e.target.files?.[0] || null)}
                      style={{ marginBottom: '12px', fontSize: '13px' }}
                    />
                    <PresetButtons.Import
                      onClick={handleImportCurveSpecs}
                      disabled={!curveSpecFile || loading}
                      fullWidth
                    />
                  </div>

                  {/* APIから取得 */}
                  <div style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                      登録済みデータから取得
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                      曲線諸元管理ページで登録したデータを読み込みます
                    </p>
                    <StandardButton
                      onClick={handleLoadCurveSpecsFromAPI}
                      disabled={loading}
                      label="APIから取得"
                      type="success"
                      fullWidth
                    />
                  </div>
                </div>

                <div style={{
                  background: '#f3f4f6',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  ℹ️ 曲線諸元データは省略可能です。読み込むと波形チャートに曲線区間が表示されます。
                </div>
              </div>
            )}
          </div>
        )}

        {/* ステップ1: ファイルアップロードと復元波形計算 */}
        {!restorationResult && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>ステップ1: 復元波形計算</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                検測データファイル (CSV):
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ padding: '8px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  データタイプ:
                </label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                >
                  <option value="alignment">通り</option>
                  <option value="level">高低</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  復元波長下限 (m):
                </label>
                <input
                  type="number"
                  value={lambdaLower}
                  onChange={(e) => setLambdaLower(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  復元波長上限 (m):
                </label>
                <input
                  type="number"
                  value={lambdaUpper}
                  onChange={(e) => setLambdaUpper(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <PresetButtons.Execute
              onClick={handleCalculateRestoration}
              disabled={!file || loading}
              loading={loading}
              label="復元波形計算実行"
            />
          </div>
        )}

        {/* ステップ2: 計画線編集と移動量計算 */}
        {restorationResult && (
          <>
            {/* 統計情報サマリー */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>復元後σ値</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>
                  {restorationResult.statistics.sigma.toFixed(3)} mm
                </div>
              </div>

              {movementResult && (
                <>
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '2px solid #f59e0b'
                  }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>移動量σ値</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>
                      {movementResult.statistics.movement.sigma.toFixed(3)} mm
                    </div>
                  </div>

                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '2px solid #10b981'
                  }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>整正後予測σ値</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>
                      {movementResult.statistics.predicted.sigma.toFixed(3)} mm
                    </div>
                  </div>

                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '2px solid #8b5cf6'
                  }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>良化率</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#8b5cf6' }}>
                      {movementResult.improvementRate.toFixed(1)} %
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 曲線諸元から計画線を自動生成 */}
            {curveSpecs.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: '2px solid #10b981'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#065f46' }}>曲線諸元から計画線を自動生成</h4>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                  読み込んだ曲線諸元データ（{curveSpecSummary?.totalCurves || curveSpecs.length}区間）に基づいて、
                  直線区間・緩和曲線・円曲線に応じた計画線を自動的に生成します。
                </p>
                <StandardButton
                  onClick={handleAutoGeneratePlanFromCurves}
                  disabled={loading}
                  loading={loading}
                  label="曲線諸元から計画線を自動生成"
                  icon="✨"
                  type="success"
                />
              </div>
            )}

            {/* 計画線編集エディタ */}
            <InteractivePlanLineEditor
              restoredWaveform={restorationResult.restoredWaveform}
              initialPlanLine={planLine || undefined}
              onPlanLineChange={handlePlanLineChange}
            />

            {/* 波形チャート */}
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>波形・移動量チャート</h3>
              <WaveformChart
                restoredWaveform={restorationResult.restoredWaveform}
                planLine={planLine || undefined}
                movement={movementResult?.movement}
                dataInterval={0.25}
                startKP={0}
                showBrush={true}
                height={450}
                standardLimit={30}
                maximumLimit={50}
                curveSpecifications={useCurveSpecs && curveSpecs.length > 0 ? curveSpecs : undefined}
              />
            </div>

            {/* 曲線区間ごとの統計分析 */}
            {curveSpecs.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '24px',
                border: '2px solid #3b82f6'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#1e40af' }}>曲線区間ごとの統計分析</h4>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                  各曲線区間（直線・緩和曲線・円曲線）ごとに復元波形と移動量の統計値を分析します。
                </p>
                <PresetButtons.Calculate
                  onClick={handleCalculateCurveSectionStats}
                  disabled={loading || !restorationResult}
                  loading={loading}
                  label="曲線区間統計を計算"
                  style={{ marginBottom: curveSectionStats ? '20px' : '0' }}
                />

                {/* 統計結果表示 */}
                {curveSectionStats && (
                  <div>
                    <div style={{
                      background: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>全体サマリー</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>総区間数: </span>
                          <strong>{curveSectionStats.overallStats.totalSections}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>直線: </span>
                          <strong>{curveSectionStats.overallStats.straightSections}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>緩和曲線: </span>
                          <strong>{curveSectionStats.overallStats.transitionSections}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>円曲線: </span>
                          <strong>{curveSectionStats.overallStats.circularSections}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f3f4f6', position: 'sticky', top: 0 }}>
                          <tr>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>区間</th>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>種別</th>
                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>データ点数</th>
                            <th colSpan={4} style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', background: '#dbeafe' }}>復元波形 (mm)</th>
                            {movementResult && (
                              <th colSpan={4} style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', background: '#fef3c7' }}>移動量 (mm)</th>
                            )}
                          </tr>
                          <tr style={{ fontSize: '11px', color: '#6b7280' }}>
                            <th style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}></th>
                            <th style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}></th>
                            <th style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}></th>
                            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>最小</th>
                            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>最大</th>
                            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>平均</th>
                            <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>σ</th>
                            {movementResult && (
                              <>
                                <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>最小</th>
                                <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>最大</th>
                                <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>平均</th>
                                <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>σ</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {curveSectionStats.sectionStatistics.map((section: any, index: number) => {
                            const curveTypeLabels = {
                              straight: '直線',
                              transition: '緩和曲線',
                              circular: '円曲線'
                            };
                            const curveTypeColors = {
                              straight: '#e0f2fe',
                              transition: '#fef3c7',
                              circular: '#fee2e2'
                            };

                            return (
                              <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px' }}>
                                  {section.curve.startKP.toFixed(3)} - {section.curve.endKP.toFixed(3)} km
                                </td>
                                <td style={{ padding: '8px' }}>
                                  <span style={{
                                    padding: '3px 8px',
                                    background: curveTypeColors[section.curve.curveType as keyof typeof curveTypeColors],
                                    borderRadius: '4px',
                                    fontSize: '11px'
                                  }}>
                                    {curveTypeLabels[section.curve.curveType as keyof typeof curveTypeLabels]}
                                  </span>
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{section.dataPoints}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>{section.restoredWaveform.min.toFixed(2)}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>{section.restoredWaveform.max.toFixed(2)}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>{section.restoredWaveform.mean.toFixed(2)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{section.restoredWaveform.sigma.toFixed(2)}</td>
                                {movementResult && section.movement && (
                                  <>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{section.movement.min.toFixed(2)}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{section.movement.max.toFixed(2)}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{section.movement.mean.toFixed(2)}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{section.movement.sigma.toFixed(2)}</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 移動量制限超過情報 */}
            {movementResult?.violations && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '24px'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>移動量制限チェック結果</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{
                    padding: '16px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #f59e0b'
                  }}>
                    <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                      標準値超過 (30mm超)
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
                      {movementResult.violations.standardExceeded.length} 箇所
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#fee2e2',
                    borderRadius: '8px',
                    border: '1px solid #ef4444'
                  }}>
                    <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '8px' }}>
                      最大値超過 (50mm超)
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444' }}>
                      {movementResult.violations.maximumExceeded.length} 箇所
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* レポート生成セクション */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '24px',
              border: '2px solid #8b5cf6'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#6b21a8' }}>レポート生成</h4>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                復元波形、計画線、移動量、曲線諸元データをCSV形式でエクスポートします。
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <StandardButton
                  onClick={() => handleGenerateCurveReport('comprehensive')}
                  disabled={loading}
                  label="総合レポート"
                  icon="📊"
                  type="info"
                />
                <StandardButton
                  onClick={() => handleGenerateCurveReport('curve-sections')}
                  disabled={loading || curveSpecs.length === 0}
                  label="曲線区間統計"
                  icon="📈"
                  type="info"
                />
                <StandardButton
                  onClick={() => handleGenerateCurveReport('detailed-data')}
                  disabled={loading}
                  label="詳細データ"
                  icon="📋"
                  type="primary"
                />
              </div>
            </div>

            {/* リセットボタン */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <PresetButtons.Reset
                onClick={() => {
                  setRestorationResult(null);
                  setPlanLine(null);
                  setMovementResult(null);
                  setFile(null);
                  setCurveSectionStats(null);
                }}
                label="新しいデータで再計算"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RestorationWorkspacePage;
