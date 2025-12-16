/**
 * ワークフローマネージャー
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく
 * 作業手順の管理と導線の確立
 */

import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import './WorkflowManager.css';

// ワークフローステップの定義
interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  component?: React.ComponentType<any>;
  required: boolean;
  completed: boolean;
}

// ワークフローのコンテキスト
interface WorkflowContextData {
  // データ
  measurementData: any;
  restoredWaveform: any;
  planLine: any;
  curveElements: any[];
  verticalCurves: any[];
  correctionMode: 'none' | 'standard' | 'mtt';
  mttType: string;

  // メソッド
  updateStepData: (stepId: string, data: any) => void;
  getStepData: (stepId: string) => any;
  validateStep: (stepId: string) => boolean;
  markStepCompleted: (stepId: string) => void;
}

// コンテキストの作成
const WorkflowContext = createContext<WorkflowContextData | null>(null);

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
};

interface WorkflowManagerProps {
  children?: React.ReactNode;
}

const WorkflowManager: React.FC<WorkflowManagerProps> = ({ children }) => {
  // ワークフローステップの定義
  const [steps] = useState<WorkflowStep[]>([
    {
      id: 'data-import',
      title: '1. データ読込',
      description: '測定データ（MDT/CSV）の読み込み',
      required: true,
      completed: false
    },
    {
      id: 'alignment',
      title: '2. 位置合わせ',
      description: '手測データとキヤデータの位置合わせ',
      required: true,
      completed: false
    },
    {
      id: 'curve-input',
      title: '3. 曲線諸元',
      description: '水平曲線諸元の入力と台形差引',
      required: true,
      completed: false
    },
    {
      id: 'vertical-curve',
      title: '4. 縦曲線',
      description: '10m弦縦曲線の入力と除去',
      required: false,
      completed: false
    },
    {
      id: 'restoration',
      title: '5. 復元波形',
      description: 'FFT/IIRによる復元波形計算',
      required: true,
      completed: false
    },
    {
      id: 'plan-line',
      title: '6. 計画線設定',
      description: '凸型計画線の設定と調整',
      required: true,
      completed: false
    },
    {
      id: 'optimization',
      title: '7. 最適化',
      description: 'こう上優先最適化の実行',
      required: true,
      completed: false
    },
    {
      id: 'correction',
      title: '8. 移動量補正',
      description: '補正モード（無/有/M）の選択',
      required: true,
      completed: false
    },
    {
      id: 'export',
      title: '9. 出力',
      description: '計算結果のファイル出力',
      required: true,
      completed: false
    }
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // ワークフローデータ
  const [workflowData, setWorkflowData] = useState<WorkflowContextData>({
    measurementData: null,
    restoredWaveform: null,
    planLine: null,
    curveElements: [],
    verticalCurves: [],
    correctionMode: 'none',
    mttType: '08-475',

    updateStepData: (stepId: string, data: any) => {
      setStepData(prev => ({ ...prev, [stepId]: data }));
      setWorkflowData(prev => {
        // ステップIDに応じてデータを更新
        switch (stepId) {
          case 'data-import':
            return { ...prev, measurementData: data };
          case 'restoration':
            return { ...prev, restoredWaveform: data };
          case 'plan-line':
            return { ...prev, planLine: data };
          case 'curve-input':
            return { ...prev, curveElements: data };
          case 'vertical-curve':
            return { ...prev, verticalCurves: data };
          case 'correction':
            return { ...prev, correctionMode: data.mode, mttType: data.mttType };
          default:
            return prev;
        }
      });
    },

    getStepData: (stepId: string) => {
      return stepData[stepId];
    },

    validateStep: (stepId: string) => {
      const step = steps.find(s => s.id === stepId);
      if (!step) return false;

      // ステップ別のバリデーション
      switch (stepId) {
        case 'data-import':
          return workflowData.measurementData !== null;
        case 'alignment':
          return true; // 位置合わせは完了扱い
        case 'curve-input':
          return true; // 曲線諸元は任意
        case 'vertical-curve':
          return true; // 縦曲線は任意
        case 'restoration':
          return workflowData.restoredWaveform !== null &&
                 workflowData.restoredWaveform.length > 0;
        case 'plan-line':
          // 計画線データが存在し、適切な構造を持っているか確認
          return workflowData.planLine !== null &&
                 workflowData.planLine.positions &&
                 Array.isArray(workflowData.planLine.positions) &&
                 workflowData.planLine.positions.length > 0;
        case 'optimization':
          return true; // 最適化は実行可能
        case 'correction':
          return workflowData.correctionMode !== 'none' ||
                 stepData['correction']?.mode !== undefined;
        case 'export':
          return true; // エクスポート可能
        default:
          return true;
      }
    },

    markStepCompleted: (stepId: string) => {
      setCompletedSteps(prev => new Set(prev).add(stepId));
    }
  });

  // ステップナビゲーション
  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  }, [steps.length]);

  const goToNextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      // 現在のステップを完了としてマーク
      workflowData.markStepCompleted(steps[currentStepIndex].id);
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }, [currentStepIndex, steps, workflowData]);

  const goToPrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  // 進捗計算
  const calculateProgress = useCallback(() => {
    const requiredSteps = steps.filter(s => s.required);
    const completedRequiredSteps = requiredSteps.filter(s => completedSteps.has(s.id));
    return (completedRequiredSteps.length / requiredSteps.length) * 100;
  }, [steps, completedSteps]);

  const currentStep = steps[currentStepIndex];
  const progress = calculateProgress();

  return (
    <WorkflowContext.Provider value={workflowData}>
      <div className="workflow-manager">
        {/* プログレスバー */}
        <div className="workflow-header">
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">
              進捗: {progress.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* ステップインジケーター */}
        <div className="workflow-steps">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`workflow-step ${
                index === currentStepIndex ? 'active' : ''
              } ${completedSteps.has(step.id) ? 'completed' : ''} ${
                !step.required ? 'optional' : ''
              }`}
              onClick={() => goToStep(index)}
            >
              <div className="step-number">
                {completedSteps.has(step.id) ? '✓' : index + 1}
              </div>
              <div className="step-info">
                <div className="step-title">{step.title}</div>
                <div className="step-description">{step.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 現在のステップコンテンツ */}
        <div className="workflow-content">
          <div className="content-header">
            <h2>{currentStep.title}</h2>
            <p>{currentStep.description}</p>
            {!currentStep.required && (
              <div className="optional-badge">オプション</div>
            )}
          </div>

          <div className="content-body">
            {/* ここに各ステップのコンポーネントを表示 */}
            {children || (
              <div className="step-placeholder">
                <p>ステップ: {currentStep.id}</p>
                <p>コンポーネントを実装中...</p>
              </div>
            )}
          </div>

          {/* ナビゲーションボタン */}
          <div className="workflow-navigation">
            <button
              className="nav-button prev"
              onClick={goToPrevStep}
              disabled={currentStepIndex === 0}
            >
              ← 前へ
            </button>

            {!currentStep.required && (
              <button
                className="nav-button skip"
                onClick={goToNextStep}
              >
                スキップ
              </button>
            )}

            <button
              className="nav-button next"
              onClick={goToNextStep}
              disabled={
                currentStepIndex === steps.length - 1 ||
                (currentStep.required && !workflowData.validateStep(currentStep.id))
              }
            >
              次へ →
            </button>
          </div>
        </div>

        {/* ステップ間データ状態の表示（デバッグ用） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="workflow-debug">
            <details>
              <summary>ワークフローデータ</summary>
              <pre>
                {JSON.stringify(
                  {
                    currentStep: currentStep.id,
                    completedSteps: Array.from(completedSteps),
                    hasData: {
                      measurement: !!workflowData.measurementData,
                      restored: !!workflowData.restoredWaveform,
                      planLine: !!workflowData.planLine,
                      curves: workflowData.curveElements.length,
                      verticalCurves: workflowData.verticalCurves.length
                    }
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        )}
      </div>
    </WorkflowContext.Provider>
  );
};

export default WorkflowManager;