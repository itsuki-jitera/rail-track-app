import React, { useState, useRef } from 'react';
import axios from 'axios';

interface CurveSpec {
  startKP: number;
  endKP: number;
  curveType: 'straight' | 'transition' | 'circular';
  radius?: number | null;
  cant?: number | null;
  direction?: 'left' | 'right' | null;
  label?: string;
  length?: number;
}

interface ValidationError {
  type: string;
  message: string;
  kp?: number;
}

export const CurveSpecManagementPage: React.FC = () => {
  const [curveSpecs, setCurveSpecs] = useState<CurveSpec[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [editingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSVインポート
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5000/api/curve-spec/import', formData);

      if (response.data.success) {
        setCurveSpecs(response.data.curveSpecs);
        setSummary(response.data.summary);
        alert(`✓ ${response.data.message}`);

        // バリデーションを実行
        await validateCurveSpecs();
      } else {
        alert('エラー: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      alert('インポートエラーが発生しました: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // バリデーション実行
  const validateCurveSpecs = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/curve-spec/validate');
      if (response.data.success) {
        setValidationErrors(response.data.errors || []);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  // 曲線諸元更新
  const handleUpdate = async () => {
    setLoading(true);
    try {
      const response = await axios.put('http://localhost:5000/api/curve-spec/update', {
        curveSpecs
      });

      if (response.data.success) {
        setSummary(response.data.summary);
        await validateCurveSpecs();
        alert('✓ 更新しました');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      alert('更新エラー: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // CSVエクスポート
  const handleExport = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/curve-spec/export', {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `curve_spec_${Date.now()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      alert('✓ CSVファイルをエクスポートしました');
    } catch (error: any) {
      console.error('Export error:', error);
      alert('エクスポートエラー: ' + (error.response?.data?.error || error.message));
    }
  };

  // 新規行追加
  const handleAddRow = () => {
    const newSpec: CurveSpec = {
      startKP: curveSpecs.length > 0 ? curveSpecs[curveSpecs.length - 1].endKP : 0,
      endKP: curveSpecs.length > 0 ? curveSpecs[curveSpecs.length - 1].endKP + 1 : 1,
      curveType: 'straight',
      label: ''
    };
    setCurveSpecs([...curveSpecs, newSpec]);
  };

  // 行削除
  const handleDeleteRow = (index: number) => {
    if (confirm('この曲線諸元を削除しますか？')) {
      setCurveSpecs(curveSpecs.filter((_, i) => i !== index));
    }
  };

  // セル値変更
  const handleCellChange = (index: number, field: keyof CurveSpec, value: any) => {
    const updated = [...curveSpecs];
    updated[index] = { ...updated[index], [field]: value };
    setCurveSpecs(updated);
  };

  // 曲線種別の日本語表示
  // const getCurveTypeName = (type: string) => {
  //   const names: Record<string, string> = {
  //     straight: '直線',
  //     transition: '緩和曲線',
  //     circular: '円曲線'
  //   };
  //   return names[type] || type;
  // };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
      padding: '24px'
    }}>
      {/* ヘッダー */}
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto 24px auto'
      }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: 700, color: '#1f2937' }}>
          曲線諸元管理
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: '#6b7280' }}>
          Curve Specification Management - VB6 KCDW互換
        </p>
      </div>

      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* コントロールパネル */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}>
              📁 CSVインポート
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={loading}
              />
            </label>

            <button
              onClick={handleAddRow}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              ➕ 新規追加
            </button>

            <button
              onClick={handleUpdate}
              disabled={loading || curveSpecs.length === 0}
              style={{
                padding: '10px 20px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: (loading || curveSpecs.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (loading || curveSpecs.length === 0) ? 0.5 : 1
              }}
            >
              💾 更新
            </button>

            <button
              onClick={handleExport}
              disabled={loading || curveSpecs.length === 0}
              style={{
                padding: '10px 20px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: (loading || curveSpecs.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (loading || curveSpecs.length === 0) ? 0.5 : 1
              }}
            >
              📥 CSVエクスポート
            </button>

            <button
              onClick={validateCurveSpecs}
              disabled={loading || curveSpecs.length === 0}
              style={{
                padding: '10px 20px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: (loading || curveSpecs.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (loading || curveSpecs.length === 0) ? 0.5 : 1
              }}
            >
              ✓ バリデーション
            </button>
          </div>
        </div>

        {/* 統計サマリー */}
        {summary && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid #3b82f6'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>総曲線数</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
                {summary.totalCurves} 件
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid #e0f2fe'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>直線</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0ea5e9' }}>
                {summary.straightCount} 件
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid #fef3c7'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>緩和曲線</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
                {summary.transitionCount} 件
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid #fee2e2'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>円曲線</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444' }}>
                {summary.circularCount} 件
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid #10b981'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>総延長</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>
                {summary.totalLength.toFixed(3)} km
              </div>
            </div>
          </div>
        )}

        {/* バリデーションエラー */}
        {validationErrors.length > 0 && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: '12px' }}>
              ⚠️ {validationErrors.length}件の問題が見つかりました
            </div>
            {validationErrors.map((error, index) => (
              <div key={index} style={{
                padding: '8px 12px',
                background: 'white',
                borderRadius: '6px',
                marginBottom: '8px',
                fontSize: '13px',
                color: '#7f1d1d'
              }}>
                <strong>[{error.type}]</strong> {error.message}
              </div>
            ))}
          </div>
        )}

        {/* 曲線諸元テーブル */}
        {curveSpecs.length > 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>曲線諸元一覧</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
              }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>No.</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>開始KP (km)</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>終了KP (km)</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>延長 (km)</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>曲線種別</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>半径 (m)</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>カント (mm)</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>方向</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>ラベル</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {curveSpecs.map((spec, index) => (
                    <tr key={index} style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: editingIndex === index ? '#fef3c7' : 'white'
                    }}>
                      <td style={{ padding: '12px 8px' }}>{index + 1}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="number"
                          step="0.001"
                          value={spec.startKP}
                          onChange={(e) => handleCellChange(index, 'startKP', parseFloat(e.target.value))}
                          style={{
                            width: '100px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="number"
                          step="0.001"
                          value={spec.endKP}
                          onChange={(e) => handleCellChange(index, 'endKP', parseFloat(e.target.value))}
                          style={{
                            width: '100px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px', color: '#6b7280' }}>
                        {(spec.endKP - spec.startKP).toFixed(3)}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <select
                          value={spec.curveType}
                          onChange={(e) => handleCellChange(index, 'curveType', e.target.value)}
                          style={{
                            width: '120px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}
                        >
                          <option value="straight">直線</option>
                          <option value="transition">緩和曲線</option>
                          <option value="circular">円曲線</option>
                        </select>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="number"
                          value={spec.radius || ''}
                          onChange={(e) => handleCellChange(index, 'radius', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="-"
                          style={{
                            width: '80px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            textAlign: 'right'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="number"
                          value={spec.cant || ''}
                          onChange={(e) => handleCellChange(index, 'cant', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="-"
                          style={{
                            width: '80px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            textAlign: 'right'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <select
                          value={spec.direction || ''}
                          onChange={(e) => handleCellChange(index, 'direction', e.target.value || null)}
                          style={{
                            width: '80px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}
                        >
                          <option value="">-</option>
                          <option value="left">左</option>
                          <option value="right">右</option>
                        </select>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="text"
                          value={spec.label || ''}
                          onChange={(e) => handleCellChange(index, 'label', e.target.value)}
                          placeholder="ラベル"
                          style={{
                            width: '150px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteRow(index)}
                          style={{
                            padding: '4px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              曲線諸元データがありません
            </div>
            <div style={{ fontSize: '14px' }}>
              CSVファイルをインポートするか、新規追加ボタンで追加してください
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurveSpecManagementPage;
