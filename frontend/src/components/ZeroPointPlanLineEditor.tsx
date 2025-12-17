/**
 * ゼロ点計画線エディタコンポーネント
 * 復元波形のゼロクロス点を可視化し、計画線を動的に調整する
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Slider,
  Grid,
  Alert,
  Chip,
  Divider,
  FormControlLabel,
  Switch,
  TextField
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Scatter,
  ScatterChart,
  ComposedChart,
  ResponsiveContainer,
  Dot
} from 'recharts';
import {
  Timeline,
  ShowChart,
  VerticalAlignCenter,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface Props {
  restoredWaveform: Array<{ distance: number; value: number }>;
  onPlanLineUpdate?: (planLine: Array<{ distance: number; value: number }>) => void;
}

interface ZeroCrossPoint {
  distance: number;
  value: number;
  type: 'ascending' | 'descending' | 'exact' | 'boundary_start' | 'boundary_end';
  originalIndex: number;
}

interface MovementRestrictions {
  standard: number;
  maximum: number;
  upwardPriority: boolean;
  fixedPoints: Array<{
    startDistance: number;
    endDistance: number;
    maxMovement: number;
  }>;
}

interface PlanLineQuality {
  averageMovement: string;
  maxMovement: string;
  totalMovement: string;
  upwardRatio: string;
  standardDeviation: string;
  quality: number;
}

const ZeroPointPlanLineEditor: React.FC<Props> = ({ restoredWaveform, onPlanLineUpdate }) => {
  const [planLine, setPlanLine] = useState<Array<{ distance: number; value: number }>>([]);
  const [initialPlanLine, setInitialPlanLine] = useState<Array<{ distance: number; value: number }>>([]);
  const [zeroCrossPoints, setZeroCrossPoints] = useState<ZeroCrossPoint[]>([]);
  const [quality, setQuality] = useState<PlanLineQuality | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showZeroPoints, setShowZeroPoints] = useState(true);
  const [showInitialPlanLine, setShowInitialPlanLine] = useState(false);
  const [interpolationMethod, setInterpolationMethod] = useState<'linear' | 'spline'>('spline');

  const [restrictions, setRestrictions] = useState<MovementRestrictions>({
    standard: 30,
    maximum: 50,
    upwardPriority: true,
    fixedPoints: []
  });

  // ゼロ点計画線を計算
  const calculateZeroPointPlanLine = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/restoration/zero-point-plan-line`, {
        restoredWaveform,
        restrictions,
        options: {
          samplingInterval: 0.25,
          interpolationMethod
        }
      });

      if (response.data.success) {
        setPlanLine(response.data.planLine);
        setInitialPlanLine(response.data.initialPlanLine);
        setZeroCrossPoints(response.data.zeroCrossPoints);
        setQuality(response.data.quality);

        if (onPlanLineUpdate) {
          onPlanLineUpdate(response.data.planLine);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'ゼロ点計画線の計算に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時に自動計算
  useEffect(() => {
    if (restoredWaveform && restoredWaveform.length > 0) {
      calculateZeroPointPlanLine();
    }
  }, []);

  // グラフ用のデータを準備
  const prepareChartData = () => {
    const data = restoredWaveform.map((point, index) => {
      const planLinePoint = planLine[index];
      const initialPlanLinePoint = initialPlanLine[index];
      const movement = planLinePoint ? planLinePoint.value - point.value : 0;

      return {
        distance: point.distance,
        restoredWaveform: point.value,
        planLine: planLinePoint?.value,
        initialPlanLine: showInitialPlanLine ? initialPlanLinePoint?.value : null,
        movement: Math.abs(movement),
        zeroLine: 0
      };
    });

    return data;
  };

  // ゼロクロス点のマーカーをカスタマイズ
  const ZeroCrossDot = (props: any) => {
    const { cx, cy, payload } = props;
    const zeroCross = zeroCrossPoints.find(
      p => Math.abs(p.distance - payload.distance) < 0.1
    );

    if (!zeroCross || !showZeroPoints) return null;

    const color = zeroCross.type === 'ascending' ? '#4CAF50' :
                   zeroCross.type === 'descending' ? '#F44336' :
                   '#FFC107';

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
      />
    );
  };

  // 品質評価の色を取得
  const getQualityColor = (score: number) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 70) return '#FFC107';
    if (score >= 50) return '#FF9800';
    return '#F44336';
  };

  // 固定点を追加
  const addFixedPoint = () => {
    const newPoint = {
      startDistance: 0,
      endDistance: 100,
      maxMovement: 10
    };
    setRestrictions({
      ...restrictions,
      fixedPoints: [...restrictions.fixedPoints, newPoint]
    });
  };

  // 固定点を削除
  const removeFixedPoint = (index: number) => {
    const newPoints = [...restrictions.fixedPoints];
    newPoints.splice(index, 1);
    setRestrictions({
      ...restrictions,
      fixedPoints: newPoints
    });
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Timeline sx={{ mr: 1 }} />
          <Typography variant="h5">ゼロ点計画線エディタ</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 制御パネル */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>移動量制限設定</Typography>
            <Box sx={{ px: 2 }}>
              <Typography variant="body2">標準制限: {restrictions.standard}mm</Typography>
              <Slider
                value={restrictions.standard}
                onChange={(_, value) => setRestrictions({ ...restrictions, standard: value as number })}
                min={10}
                max={50}
                step={5}
                marks
                valueLabelDisplay="auto"
              />

              <Typography variant="body2">最大制限: {restrictions.maximum}mm</Typography>
              <Slider
                value={restrictions.maximum}
                onChange={(_, value) => setRestrictions({ ...restrictions, maximum: value as number })}
                min={30}
                max={100}
                step={5}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography gutterBottom>表示オプション</Typography>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={showZeroPoints}
                    onChange={(e) => setShowZeroPoints(e.target.checked)}
                  />
                }
                label="ゼロクロス点を表示"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showInitialPlanLine}
                    onChange={(e) => setShowInitialPlanLine(e.target.checked)}
                  />
                }
                label="初期計画線を表示"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={restrictions.upwardPriority}
                    onChange={(e) => setRestrictions({ ...restrictions, upwardPriority: e.target.checked })}
                  />
                }
                label="こう上優先"
              />
            </Box>
          </Grid>
        </Grid>

        {/* 固定点設定 */}
        <Box sx={{ mb: 3 }}>
          <Typography gutterBottom>不動点・保守困難箇所</Typography>
          {restrictions.fixedPoints.map((point, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TextField
                size="small"
                label="開始位置(m)"
                type="number"
                value={point.startDistance}
                onChange={(e) => {
                  const newPoints = [...restrictions.fixedPoints];
                  newPoints[index].startDistance = parseFloat(e.target.value);
                  setRestrictions({ ...restrictions, fixedPoints: newPoints });
                }}
                sx={{ mr: 1, width: 120 }}
              />
              <TextField
                size="small"
                label="終了位置(m)"
                type="number"
                value={point.endDistance}
                onChange={(e) => {
                  const newPoints = [...restrictions.fixedPoints];
                  newPoints[index].endDistance = parseFloat(e.target.value);
                  setRestrictions({ ...restrictions, fixedPoints: newPoints });
                }}
                sx={{ mr: 1, width: 120 }}
              />
              <TextField
                size="small"
                label="最大移動量(mm)"
                type="number"
                value={point.maxMovement}
                onChange={(e) => {
                  const newPoints = [...restrictions.fixedPoints];
                  newPoints[index].maxMovement = parseFloat(e.target.value);
                  setRestrictions({ ...restrictions, fixedPoints: newPoints });
                }}
                sx={{ mr: 1, width: 120 }}
              />
              <Button size="small" onClick={() => removeFixedPoint(index)}>削除</Button>
            </Box>
          ))}
          <Button size="small" variant="outlined" onClick={addFixedPoint}>
            固定点を追加
          </Button>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            onClick={calculateZeroPointPlanLine}
            disabled={loading}
            startIcon={<VerticalAlignCenter />}
          >
            ゼロ点計画線を計算
          </Button>
        </Box>

        {/* 統計情報 */}
        {zeroCrossPoints.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              ゼロクロス点: {zeroCrossPoints.length}個検出
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {zeroCrossPoints.slice(0, 10).map((point, index) => (
                <Chip
                  key={index}
                  label={`${point.distance.toFixed(1)}m`}
                  size="small"
                  color={point.type === 'ascending' ? 'success' : 'error'}
                />
              ))}
              {zeroCrossPoints.length > 10 && (
                <Chip label={`他 ${zeroCrossPoints.length - 10}個`} size="small" />
              )}
            </Box>
          </Box>
        )}

        {/* 品質評価 */}
        {quality && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>計画線品質評価</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">平均移動量</Typography>
                <Typography variant="h6">{quality.averageMovement}mm</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">最大移動量</Typography>
                <Typography variant="h6">{quality.maxMovement}mm</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">こう上率</Typography>
                <Typography variant="h6">{quality.upwardRatio}%</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">品質スコア</Typography>
                <Typography
                  variant="h6"
                  style={{ color: getQualityColor(quality.quality) }}
                >
                  {quality.quality}/100
                </Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* グラフ表示 */}
        {planLine.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>復元波形と計画線</Typography>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="distance"
                  label={{ value: '距離 (m)', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis
                  label={{ value: '変位 (mm)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="5 5" />

                <Line
                  type="monotone"
                  dataKey="restoredWaveform"
                  stroke="#2196F3"
                  name="復元波形"
                  strokeWidth={2}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="planLine"
                  stroke="#FF5722"
                  name="計画線（調整後）"
                  strokeWidth={2}
                  dot={false}
                />

                {showInitialPlanLine && (
                  <Line
                    type="monotone"
                    dataKey="initialPlanLine"
                    stroke="#9C27B0"
                    name="初期計画線"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="zeroLine"
                  stroke="transparent"
                  dot={<ZeroCrossDot />}
                />
              </ComposedChart>
            </ResponsiveContainer>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>移動量</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="distance"
                  label={{ value: '距離 (m)', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis
                  label={{ value: '移動量 (mm)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />

                <ReferenceLine y={restrictions.standard} stroke="#FFC107" strokeDasharray="5 5" label="標準制限" />
                <ReferenceLine y={restrictions.maximum} stroke="#F44336" strokeDasharray="5 5" label="最大制限" />

                <Line
                  type="monotone"
                  dataKey="movement"
                  stroke="#4CAF50"
                  name="移動量（絶対値）"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ZeroPointPlanLineEditor;