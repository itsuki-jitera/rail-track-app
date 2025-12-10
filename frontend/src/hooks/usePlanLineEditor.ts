/**
 * 計画線編集カスタムフック
 * Custom hook for plan line editing
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import { DataPoint } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

export interface PlanLineEditorOptions {
  onUpdate?: (planLine: DataPoint[]) => void;
  onError?: (error: string) => void;
}

export const usePlanLineEditor = (initialPlanLine: DataPoint[], options?: PlanLineEditorOptions) => {
  const [planLine, setPlanLine] = useState<DataPoint[]>(initialPlanLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // 計画線を直線に設定
  const setStraightLine = useCallback(async (
    startDistance: number,
    endDistance: number,
    startValue: number,
    endValue: number
  ) => {
    setIsProcessing(true);
    setLastError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/restoration/set-straight-line`, {
        planLine,
        startDistance,
        endDistance,
        startValue,
        endValue
      });

      if (response.data.success && response.data.updatedPlanLine) {
        const newPlanLine = response.data.updatedPlanLine;
        setPlanLine(newPlanLine);
        options?.onUpdate?.(newPlanLine);
        return newPlanLine;
      } else {
        throw new Error(response.data.error || '直線設定に失敗しました');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      setLastError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [planLine, options]);

  // 計画線を曲線に設定
  const setCircularCurve = useCallback(async (
    startDistance: number,
    endDistance: number,
    radius: number,
    centerValue: number
  ) => {
    setIsProcessing(true);
    setLastError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/restoration/set-circular-curve`, {
        planLine,
        startDistance,
        endDistance,
        radius,
        centerValue
      });

      if (response.data.success && response.data.updatedPlanLine) {
        const newPlanLine = response.data.updatedPlanLine;
        setPlanLine(newPlanLine);
        options?.onUpdate?.(newPlanLine);
        return newPlanLine;
      } else {
        throw new Error(response.data.error || '曲線設定に失敗しました');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      setLastError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [planLine, options]);

  // 区間を平滑化
  const smoothSection = useCallback(async (
    startDistance?: number,
    endDistance?: number,
    smoothingFactor: number = 0.5
  ) => {
    setIsProcessing(true);
    setLastError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/restoration/smooth-section`, {
        planLine,
        startDistance,
        endDistance,
        options: {
          smoothingFactor
        }
      });

      if (response.data.success && response.data.smoothedPlanLine) {
        const newPlanLine = response.data.smoothedPlanLine;
        setPlanLine(newPlanLine);
        options?.onUpdate?.(newPlanLine);
        return newPlanLine;
      } else {
        throw new Error(response.data.error || '平滑化に失敗しました');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      setLastError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [planLine, options]);

  // 計画線を手動で更新
  const updatePlanLine = useCallback((newPlanLine: DataPoint[]) => {
    setPlanLine(newPlanLine);
    options?.onUpdate?.(newPlanLine);
  }, [options]);

  // 計画線をリセット
  const resetPlanLine = useCallback(() => {
    setPlanLine(initialPlanLine);
    options?.onUpdate?.(initialPlanLine);
  }, [initialPlanLine, options]);

  return {
    planLine,
    setStraightLine,
    setCircularCurve,
    smoothSection,
    updatePlanLine,
    resetPlanLine,
    isProcessing,
    lastError
  };
};

export default usePlanLineEditor;
