/**
 * 統合ダッシュボードコンポーネント
 * 軌道復元システムの全作業フローを一元管理
 * Phase 4実装 - UI/UX改善
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGlobalWorkspace,
  workspaceSelectors
} from '../contexts/GlobalWorkspaceContext';
import './UnifiedDashboard.css';

interface WorkflowStep {
  id: string;
  name: string;
  icon: string;
  route: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  description: string;
  required: boolean;
  dependencies?: string[];
  progress?: number;
  errorMessage?: string;
}

interface DashboardStats {
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  estimatedTime: number;
  dataQuality: number;
  lastUpdate: Date;
}

export const UnifiedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useGlobalWorkspace();

  // ワークフローステップの定義
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    {
      id: 'data-load',
      name: 'キヤデータ読込',
      icon: '🚃',
      route: '/data-load',
      status: state.status.dataLoaded ? 'completed' : 'pending',
      description: 'MTTデータをアップロード（ファイル名先頭「X」で6文字）',
      required: true,
      progress: state.status.dataLoaded ? 100 : 0
    },
    {
      id: 'section-cut',
      name: '作業区間設定',
      icon: '📍',
      route: '/section-cut',
      status: state.status.sectionCut ? 'completed' :
              state.status.dataLoaded ? 'pending' : 'pending',
      description: '必要区間を切り取り（前後500m以上余分に切取）',
      required: true,
      dependencies: ['data-load'],
      progress: state.status.sectionCut ? 100 : 0
    },
    {
      id: 'curve-settings',
      name: '曲線諸元設定',
      icon: '📐',
      route: '/curve-settings',
      status: state.status.curveConfigured ? 'completed' : 'pending',
      description: '曲線データを入力（曲線区間がある場合）',
      required: false,
      dependencies: ['section-cut'],
      progress: state.status.curveConfigured ? 100 : 0
    },
    {
      id: 'movement-limits',
      name: '移動量制限',
      icon: '⚠️',
      route: '/movement-limits',
      status: state.status.movementLimitsSet ? 'completed' : 'pending',
      description: '制限箇所を設定（駅、橋梁、トンネル等）',
      required: false,
      dependencies: ['section-cut'],
      progress: state.status.movementLimitsSet ? 100 : 0
    },
    {
      id: 'field-measurement',
      name: '手検測入力',
      icon: '📏',
      route: '/field-measurement',
      status: state.status.fieldMeasurementSet ? 'completed' : 'pending',
      description: '手検測データを入力（必要に応じて）',
      required: false,
      dependencies: ['section-cut'],
      progress: state.status.fieldMeasurementSet ? 100 : 0
    },
    {
      id: 'waveform-calculation',
      name: '復元波形計算',
      icon: '⚙️',
      route: '/waveform-calculation',
      status: state.status.waveformCalculated ? 'completed' : 'pending',
      description: '復元波形を計算',
      required: true,
      dependencies: ['section-cut'],
      progress: state.status.waveformCalculated ? 100 : 0
    },
    {
      id: 'plan-line-and-export',
      name: '計画線設定・データ出力',
      icon: '📈',
      route: '/plan-line',
      status: state.status.planLineSet ? 'completed' : 'pending',
      description: '計画線設定と移動量計算を行い、CSV形式で出力',
      required: true,
      dependencies: ['waveform-calculation'],
      progress: state.status.planLineSet ? 100 : 0
    }
  ]);

  // ダッシュボード統計
  const [stats, setStats] = useState<DashboardStats>({
    totalSteps: workflowSteps.length,
    completedSteps: 0,
    currentStep: '',
    estimatedTime: 0,
    dataQuality: 0,
    lastUpdate: new Date()
  });

  // リアルタイム進捗更新
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5秒

  // ステップの状態を更新
  useEffect(() => {
    const updatedSteps = workflowSteps.map(step => {
      switch (step.id) {
        case 'data-load':
          return { ...step, status: state.status.dataLoaded ? 'completed' : 'pending' };
        case 'section-cut':
          return { ...step, status: state.status.sectionCut ? 'completed' :
                                    state.status.dataLoaded ? 'pending' : 'pending' };
        case 'curve-settings':
          return { ...step, status: state.status.curveConfigured ? 'completed' : 'pending' };
        case 'movement-limits':
          return { ...step, status: state.status.movementLimitsSet ? 'completed' : 'pending' };
        case 'field-measurement':
          return { ...step, status: state.status.fieldMeasurementSet ? 'completed' : 'pending' };
        case 'waveform-calculation':
          return { ...step, status: state.status.waveformCalculated ? 'completed' : 'pending' };
        case 'plan-line-and-export':
          return { ...step, status: state.status.planLineSet && state.status.dataExported ? 'completed' :
                                   state.status.planLineSet ? 'in-progress' : 'pending' };
        default:
          return step;
      }
    });

    setWorkflowSteps(updatedSteps);

    // 統計を更新
    const completed = updatedSteps.filter(s => s.status === 'completed').length;
    const currentStepObj = updatedSteps.find(s => s.status === 'pending' &&
      (!s.dependencies || s.dependencies.every(d =>
        updatedSteps.find(step => step.id === d)?.status === 'completed'
      ))
    );

    setStats(prev => ({
      ...prev,
      completedSteps: completed,
      currentStep: currentStepObj?.name || '完了',
      dataQuality: calculateDataQuality(),
      lastUpdate: new Date()
    }));
  }, [state]);

  // データ品質スコアを計算
  const calculateDataQuality = (): number => {
    let score = 0;
    const weights = {
      dataLoaded: 20,
      sectionCut: 15,
      curveConfigured: 10,
      movementLimitsSet: 10,
      fieldMeasurementSet: 5,
      waveformCalculated: 15,
      planLineSet: 15,
      movementCalculated: 10
    };

    Object.entries(state.status).forEach(([key, value]) => {
      if (value && weights[key as keyof typeof weights]) {
        score += weights[key as keyof typeof weights];
      }
    });

    return score;
  };

  // ワンクリック実行
  const executeAllSteps = async () => {
    console.log('全ステップ自動実行を開始します...');

    for (const step of workflowSteps) {
      if (step.status === 'pending' && step.required) {
        // 依存関係をチェック
        if (!step.dependencies ||
            step.dependencies.every(d =>
              workflowSteps.find(s => s.id === d)?.status === 'completed'
            )) {
          // ステップを実行
          await executeStep(step);
        }
      }
    }
  };

  // 個別ステップの実行
  const executeStep = async (step: WorkflowStep) => {
    console.log(`ステップ「${step.name}」を実行中...`);

    // ステップの実行をシミュレート
    setWorkflowSteps(prev => prev.map(s =>
      s.id === step.id ? { ...s, status: 'in-progress' as const } : s
    ));

    // 実際の処理は各ページで行うため、ここではナビゲート
    navigate(step.route);
  };

  // ステップをクリック
  const handleStepClick = (step: WorkflowStep) => {
    // 依存関係をチェック
    if (step.dependencies) {
      const unmetDependencies = step.dependencies.filter(d =>
        workflowSteps.find(s => s.id === d)?.status !== 'completed'
      );

      if (unmetDependencies.length > 0) {
        alert(`先に以下のステップを完了してください: ${
          unmetDependencies.map(d =>
            workflowSteps.find(s => s.id === d)?.name
          ).join(', ')
        }`);
        return;
      }
    }

    navigate(step.route);
  };

  // 自動リフレッシュ
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      // ここでデータを再取得（必要に応じて）
      setStats(prev => ({
        ...prev,
        lastUpdate: new Date()
      }));
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval]);

  // プログレスバーのカラー
  const getProgressColor = (progress: number): string => {
    if (progress >= 100) return '#4CAF50';
    if (progress >= 50) return '#FFC107';
    return '#2196F3';
  };

  // ステータスアイコン
  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  return (
    <div className="unified-dashboard">
      {/* ヘッダー */}
      <div className="dashboard-header">
        <h1>🎯 軌道復元システム統合ダッシュボード</h1>
        <div className="dashboard-controls">
          <button
            className="btn-execute-all"
            onClick={executeAllSteps}
            disabled={stats.completedSteps === stats.totalSteps}
          >
            🚀 全ステップ自動実行
          </button>
          <label className="auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自動更新 ({refreshInterval / 1000}秒)
          </label>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="dashboard-summary">
        <div className="stat-card">
          <div className="stat-value">{stats.completedSteps}/{stats.totalSteps}</div>
          <div className="stat-label">完了ステップ</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {Math.round((stats.completedSteps / stats.totalSteps) * 100)}%
          </div>
          <div className="stat-label">進捗率</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.currentStep}</div>
          <div className="stat-label">現在のステップ</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.dataQuality}%</div>
          <div className="stat-label">データ品質</div>
        </div>
      </div>

      {/* 全体進捗バー */}
      <div className="overall-progress">
        <div className="progress-label">全体進捗</div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${(stats.completedSteps / stats.totalSteps) * 100}%`,
              backgroundColor: getProgressColor((stats.completedSteps / stats.totalSteps) * 100)
            }}
          />
        </div>
      </div>

      {/* ワークフローステップ */}
      <div className="workflow-container">
        <h2>📋 作業フロー</h2>
        <div className="workflow-steps">
          {workflowSteps.map((step, index) => (
            <div
              key={step.id}
              className={`workflow-step ${step.status} ${!step.required ? 'optional' : ''}`}
              onClick={() => handleStepClick(step)}
            >
              <div className="step-header">
                <span className="step-number">{index + 1}</span>
                <span className="step-icon">{step.icon}</span>
                <span className="step-status">{getStatusIcon(step.status)}</span>
              </div>
              <div className="step-content">
                <h3>{step.name}</h3>
                <p>{step.description}</p>
                {!step.required && <span className="optional-badge">オプション</span>}
                {step.errorMessage && (
                  <div className="error-message">{step.errorMessage}</div>
                )}
              </div>
              {step.progress !== undefined && (
                <div className="step-progress">
                  <div
                    className="step-progress-fill"
                    style={{
                      width: `${step.progress}%`,
                      backgroundColor: getProgressColor(step.progress)
                    }}
                  />
                </div>
              )}
              {index < workflowSteps.length - 1 && (
                <div className="step-connector">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* クイックアクション */}
      <div className="quick-actions">
        <h2>⚡ クイックアクション</h2>
        <div className="action-buttons">
          <button
            onClick={() => navigate('/export')}
            className="action-btn export"
            disabled={!state.status.planLineSet}
          >
            💾 データ出力
          </button>
          <button
            onClick={() => navigate('/report')}
            className="action-btn report"
            disabled={!state.status.planLineSet}
          >
            📄 レポート生成
          </button>
          <button
            onClick={() => navigate('/quality-check')}
            className="action-btn quality"
            disabled={!state.status.waveformCalculated}
          >
            🔍 品質検証
          </button>
          <button
            onClick={() => window.location.reload()}
            className="action-btn reset"
          >
            🔄 リセット
          </button>
        </div>
      </div>

      {/* 最終更新時刻 */}
      <div className="dashboard-footer">
        <p>最終更新: {stats.lastUpdate.toLocaleTimeString('ja-JP')}</p>
      </div>
    </div>
  );
};