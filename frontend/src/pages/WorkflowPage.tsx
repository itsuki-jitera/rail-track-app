/**
 * 軌道整正計算ワークフロー統合画面
 * ウィザード形式で全ての処理を順番に実行
 */

import React, { useState, useEffect } from 'react';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';

// ステップコンポーネントのインポート（後で実装）
import { KiyaDataPage } from './KiyaDataPage';
import { WorkSectionPage } from './WorkSectionPage';
import { PositionAlignmentPage } from './PositionAlignmentPage';
import { CurveSpecManagementPage } from './CurveSpecManagementPage';
import { RestorationWorkspacePage } from './RestorationWorkspacePage';
import { PlanLinePage } from './PlanLinePage';
import { MovementCalcPage } from './MovementCalcPage';
import { ExportGeneralPage } from './ExportGeneralPage';

import './PageStyles.css';

// ステップ定義
interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  component: React.ComponentType<any>;
  validation: () => boolean;
  estimatedTime: string;
  icon: string;
}

export const WorkflowPage: React.FC = () => {
  const { state, dispatch } = useGlobalWorkspace();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [workflowData, setWorkflowData] = useState<any>({});

  // ワークフローステップ定義
  const steps: WorkflowStep[] = [
    {
      id: 'data-load',
      title: 'データ読込',
      description: 'MTTデータ（キヤ141検測車データ）を読み込みます',
      required: true,
      component: KiyaDataPage,
      validation: () => state.status.dataLoaded,
      estimatedTime: '2-3分',
      icon: '📂'
    },
    {
      id: 'work-section',
      title: '作業区間設定',
      description: '作業区間を設定し、前後500m以上の余分切取りを行います',
      required: true,
      component: WorkSectionPage,
      validation: () => state.status.sectionCut,
      estimatedTime: '3-5分',
      icon: '✂️'
    },
    {
      id: 'position-alignment',
      title: '位置合わせ',
      description: '水準狂いとカントデータを重ね合わせて位置を合わせます',
      required: true,
      component: PositionAlignmentPage,
      validation: () => state.status.positionAligned,
      estimatedTime: '2-3分',
      icon: '🎯'
    },
    {
      id: 'curve-spec',
      title: '曲線諸元設定',
      description: '曲線区間がある場合、曲線諸元を設定します',
      required: false,
      component: CurveSpecManagementPage,
      validation: () => true, // オプショナル
      estimatedTime: '5-10分',
      icon: '📐'
    },
    {
      id: 'restoration',
      title: '復元波形計算',
      description: '測定データから復元波形を計算します',
      required: true,
      component: RestorationWorkspacePage,
      validation: () => state.status.waveformCalculated,
      estimatedTime: '1-2分',
      icon: '📊'
    },
    {
      id: 'plan-line',
      title: '計画線設定',
      description: '軌道整正の目標となる計画線を設定します',
      required: true,
      component: PlanLinePage,
      validation: () => state.status.planLineSet,
      estimatedTime: '10-15分',
      icon: '📈'
    },
    {
      id: 'movement-calc',
      title: '移動量算出',
      description: '現況と計画線の差から移動量を算出します',
      required: true,
      component: MovementCalcPage,
      validation: () => state.status.movementsCalculated,
      estimatedTime: '1-2分',
      icon: '🔧'
    },
    {
      id: 'export',
      title: 'データ出力',
      description: '計算結果を各種形式で出力します',
      required: true,
      component: ExportGeneralPage,
      validation: () => true,
      estimatedTime: '1-2分',
      icon: '💾'
    }
  ];

  // 現在のステップが完了したかチェック
  const isCurrentStepCompleted = () => {
    return steps[currentStep].validation();
  };

  // ステップを進める
  const handleNext = () => {
    if (!isCurrentStepCompleted() && steps[currentStep].required) {
      alert('現在のステップを完了してから次に進んでください');
      return;
    }

    if (isCurrentStepCompleted()) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      alert('全ての処理が完了しました！');
    }
  };

  // ステップを戻る
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ステップをスキップ（オプショナルステップのみ）
  const handleSkip = () => {
    if (!steps[currentStep].required) {
      setSkippedSteps(prev => new Set(prev).add(currentStep));
      handleNext();
    }
  };

  // 特定のステップにジャンプ
  const jumpToStep = (stepIndex: number) => {
    // 前のステップが完了していることを確認
    for (let i = 0; i < stepIndex; i++) {
      if (steps[i].required && !completedSteps.has(i) && !steps[i].validation()) {
        alert(`先に「${steps[i].title}」を完了してください`);
        return;
      }
    }
    setCurrentStep(stepIndex);
  };

  // プログレス計算
  const calculateProgress = () => {
    const requiredSteps = steps.filter(s => s.required).length;
    const completedRequiredSteps = steps.filter((s, i) =>
      s.required && (completedSteps.has(i) || s.validation())
    ).length;
    return Math.round((completedRequiredSteps / requiredSteps) * 100);
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="workflow-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー：プログレスバー */}
      <div className="workflow-header" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>
          🚄 軌道整正計算ワークフロー
        </h1>

        {/* プログレスバー */}
        <div style={{
          background: 'rgba(255,255,255,0.3)',
          borderRadius: '10px',
          height: '20px',
          overflow: 'hidden',
          marginBottom: '10px'
        }}>
          <div style={{
            background: '#4caf50',
            height: '100%',
            width: `${calculateProgress()}%`,
            transition: 'width 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {calculateProgress() > 5 && `${calculateProgress()}%`}
            </span>
          </div>
        </div>

        {/* ステップインジケーター */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          overflowX: 'auto',
          paddingBottom: '10px'
        }}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              onClick={() => jumpToStep(index)}
              style={{
                flex: '1',
                minWidth: '100px',
                textAlign: 'center',
                cursor: 'pointer',
                opacity: index === currentStep ? 1 : 0.7,
                transform: index === currentStep ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background:
                  completedSteps.has(index) || step.validation() ? '#4caf50' :
                  skippedSteps.has(index) ? '#ff9800' :
                  index === currentStep ? 'white' :
                  'rgba(255,255,255,0.5)',
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                border: index === currentStep ? '3px solid white' : 'none',
                boxShadow: index === currentStep ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
              }}>
                {(completedSteps.has(index) || step.validation()) ? '✓' :
                 skippedSteps.has(index) ? '⟳' :
                 step.icon}
              </div>
              <div style={{ fontSize: '12px', fontWeight: index === currentStep ? 'bold' : 'normal' }}>
                {step.title}
              </div>
              {!step.required && (
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  (オプション)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 現在のステップ情報 */}
      <div style={{
        background: '#f5f5f5',
        padding: '15px 20px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>
              Step {currentStep + 1} / {steps.length}: {steps[currentStep].title}
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#666' }}>
              {steps[currentStep].description}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>
              推定所要時間: {steps[currentStep].estimatedTime}
            </div>
            {steps[currentStep].required ? (
              <span style={{
                display: 'inline-block',
                marginTop: '5px',
                padding: '2px 8px',
                background: '#e3f2fd',
                color: '#1976d2',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                必須
              </span>
            ) : (
              <span style={{
                display: 'inline-block',
                marginTop: '5px',
                padding: '2px 8px',
                background: '#fff3e0',
                color: '#ff9800',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                オプション
              </span>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#fafafa'
      }}>
        <CurrentStepComponent />
      </div>

      {/* ナビゲーションボタン */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderTop: '1px solid #e0e0e0',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            style={{
              padding: '12px 24px',
              background: currentStep === 0 ? '#e0e0e0' : '#f5f5f5',
              color: currentStep === 0 ? '#999' : '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ← 前のステップ
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* スキップボタン（オプショナルステップのみ） */}
            {!steps[currentStep].required && (
              <button
                onClick={handleSkip}
                style={{
                  padding: '12px 24px',
                  background: '#fff',
                  color: '#ff9800',
                  border: '2px solid #ff9800',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '500'
                }}
              >
                スキップ
              </button>
            )}

            {/* 次へボタン */}
            <button
              onClick={handleNext}
              style={{
                padding: '12px 32px',
                background:
                  currentStep === steps.length - 1 ? '#4caf50' :
                  isCurrentStepCompleted() || !steps[currentStep].required ? '#2196f3' : '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor:
                  isCurrentStepCompleted() || !steps[currentStep].required ? 'pointer' : 'not-allowed',
                fontSize: '15px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              disabled={!isCurrentStepCompleted() && steps[currentStep].required}
            >
              {currentStep === steps.length - 1 ? (
                <>完了 ✓</>
              ) : (
                <>次のステップ →</>
              )}
            </button>
          </div>
        </div>

        {/* ステータス表示 */}
        <div style={{
          marginTop: '15px',
          padding: '10px',
          background:
            isCurrentStepCompleted() ? '#e8f5e9' :
            steps[currentStep].required ? '#fff3e0' : '#e3f2fd',
          borderRadius: '6px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          {isCurrentStepCompleted() ? (
            <span style={{ color: '#4caf50' }}>
              ✓ このステップは完了しています
            </span>
          ) : steps[currentStep].required ? (
            <span style={{ color: '#ff9800' }}>
              ⚠️ このステップを完了してから次に進んでください
            </span>
          ) : (
            <span style={{ color: '#1976d2' }}>
              ℹ️ このステップはオプションです（スキップ可能）
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowPage;