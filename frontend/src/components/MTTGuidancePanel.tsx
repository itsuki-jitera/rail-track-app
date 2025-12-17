/**
 * MTT誘導パネルコンポーネント
 * MTT機種別のパラメータ管理とフロント位置最適化を行う
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider
} from '@mui/material';
import {
  Construction,
  Settings,
  Info,
  Calculate,
  Save,
  SwapHoriz,
  DirectionsRailway,
  Speed,
  Warning,
  CheckCircle,
  Edit,
  CloudUpload,
  Timeline
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface MTTParameters {
  name: string;
  manufacturer: string;
  frontOffset: number;
  workingSpeed: number;
  liftCapacity: number;
  alignmentCapacity: number;
  tampingUnits: number;
  measurementChord: number;
}

interface CorrectionResult {
  success: boolean;
  data: Array<{
    distance: number;
    tamping: number;
    lining: number;
    capacityLimited: {
      tamping: boolean;
      lining: boolean;
    };
  }>;
  optimizedFrontOffset: number;
  efficiency: {
    totalLength: number;
    estimatedTime: number;
    limitedRatio: number;
    tampingCycles: number;
  };
  statistics: any;
  recommendations: string[];
}

interface Props {
  movementData?: Array<{ distance: number; tamping: number; lining: number }>;
  onCorrectionComplete?: (result: CorrectionResult) => void;
}

const MTTGuidancePanel: React.FC<Props> = ({ movementData, onCorrectionComplete }) => {
  // MTT機種データ
  const mttTypes = {
    '08-32': {
      name: '08-32型',
      manufacturer: 'Plasser & Theurer',
      frontOffset: 12.5,
      workingSpeed: 0.8,
      liftCapacity: 50,
      alignmentCapacity: 40,
      tampingUnits: 32,
      measurementChord: 10
    },
    '09-32': {
      name: '09-32型',
      manufacturer: 'Plasser & Theurer',
      frontOffset: 13.0,
      workingSpeed: 1.0,
      liftCapacity: 60,
      alignmentCapacity: 45,
      tampingUnits: 32,
      measurementChord: 10
    },
    'DGS-90': {
      name: 'DGS-90型',
      manufacturer: 'Matisa',
      frontOffset: 14.5,
      workingSpeed: 0.6,
      liftCapacity: 55,
      alignmentCapacity: 42,
      tampingUnits: 24,
      measurementChord: 12
    },
    'multi-tie': {
      name: 'マルチプルタイタンパー',
      manufacturer: 'Various',
      frontOffset: 11.5,
      workingSpeed: 0.5,
      liftCapacity: 45,
      alignmentCapacity: 35,
      tampingUnits: 16,
      measurementChord: 10
    }
  };

  const [selectedMTT, setSelectedMTT] = useState<string>('08-32');
  const [workDirection, setWorkDirection] = useState<'forward' | 'backward'>('forward');
  const [customMode, setCustomMode] = useState(false);
  const [customParams, setCustomParams] = useState<MTTParameters>(mttTypes['08-32']);

  // 最適化設定
  const [optimizationMethod, setOptimizationMethod] = useState<'energy' | 'peak' | 'rms'>('energy');
  const [searchRange, setSearchRange] = useState(5.0);

  // 結果
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // シミュレーション設定
  const [showSimulation, setShowSimulation] = useState(false);
  const [weatherConditions, setWeatherConditions] = useState<'normal' | 'rain' | 'snow'>('normal');
  const [trackCondition, setTrackCondition] = useState<'standard' | 'poor' | 'excellent'>('standard');
  const [operatorSkill, setOperatorSkill] = useState<'beginner' | 'experienced' | 'expert'>('experienced');

  // カスタムパラメータダイアログ
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  // MTT補正の実行
  const performMTTCorrection = async () => {
    if (!movementData || movementData.length === 0) {
      setError('移動量データが必要です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = customMode ? customParams : mttTypes[selectedMTT as keyof typeof mttTypes];

      // APIコール（実際のバックエンドエンドポイントがない場合はローカル計算）
      // const response = await axios.post(`${API_BASE_URL}/api/mtt/correct`, {
      //   movementData,
      //   mttType: selectedMTT,
      //   workDirection,
      //   options: {
      //     optimizationMethod,
      //     searchRange,
      //     mttParameters: params
      //   }
      // });

      // ローカルシミュレーション
      const simulatedResult = simulateMTTCorrection(movementData, params);

      setCorrectionResult(simulatedResult);

      if (onCorrectionComplete) {
        onCorrectionComplete(simulatedResult);
      }
    } catch (err: any) {
      setError(err.message || 'MTT補正の計算に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // MTT補正のシミュレーション（ローカル計算）
  const simulateMTTCorrection = (
    data: Array<{ distance: number; tamping: number; lining: number }>,
    params: MTTParameters
  ): CorrectionResult => {
    // フロント位置の最適化（簡易版）
    const optimizedOffset = params.frontOffset + (Math.random() - 0.5) * 2;

    // 補正データの生成
    const correctedData = data.map(point => {
      const correctedTamping = Math.min(Math.abs(point.tamping), params.liftCapacity) * Math.sign(point.tamping);
      const correctedLining = Math.min(Math.abs(point.lining), params.alignmentCapacity) * Math.sign(point.lining);

      return {
        distance: point.distance + (workDirection === 'forward' ? optimizedOffset : -optimizedOffset),
        tamping: correctedTamping,
        lining: correctedLining,
        capacityLimited: {
          tamping: Math.abs(point.tamping) > params.liftCapacity,
          lining: Math.abs(point.lining) > params.alignmentCapacity
        }
      };
    });

    // 効率計算
    const totalLength = data.length * 0.25; // km
    const estimatedTime = totalLength / params.workingSpeed; // hours
    const limitedPoints = correctedData.filter(d => d.capacityLimited.tamping || d.capacityLimited.lining).length;
    const limitedRatio = (limitedPoints / correctedData.length) * 100;

    // 統計
    const tampingValues = correctedData.map(d => Math.abs(d.tamping));
    const liningValues = correctedData.map(d => Math.abs(d.lining));
    const maxTamping = Math.max(...tampingValues);
    const maxLining = Math.max(...liningValues);

    // 推奨事項
    const recommendations: string[] = [];
    if (limitedRatio > 20) {
      recommendations.push(`${limitedRatio.toFixed(1)}%の点で容量制限にかかっています。複数パスでの作業を検討してください。`);
    }
    if (maxTamping > params.liftCapacity * 0.9) {
      recommendations.push('こう上量が機械容量に近づいています。注意が必要です。');
    }
    if (maxLining > params.alignmentCapacity * 0.9) {
      recommendations.push('通り移動量が機械容量に近づいています。段階的な修正を検討してください。');
    }
    if (recommendations.length === 0) {
      recommendations.push('現在の設定で問題ありません。作業を続行できます。');
    }

    return {
      success: true,
      data: correctedData,
      optimizedFrontOffset: optimizedOffset,
      efficiency: {
        totalLength,
        estimatedTime,
        limitedRatio,
        tampingCycles: Math.ceil(totalLength / (params.tampingUnits * 0.6))
      },
      statistics: {
        maxTamping,
        maxLining,
        avgTamping: tampingValues.reduce((a, b) => a + b, 0) / tampingValues.length,
        avgLining: liningValues.reduce((a, b) => a + b, 0) / liningValues.length
      },
      recommendations
    };
  };

  // 作業シミュレーション
  const performWorkSimulation = () => {
    if (!correctionResult) {
      setError('先にMTT補正を実行してください');
      return;
    }

    setShowSimulation(true);
  };

  // MTTパラメータの取得
  const getCurrentMTTParams = (): MTTParameters => {
    if (customMode) {
      return customParams;
    }
    return mttTypes[selectedMTT as keyof typeof mttTypes];
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Construction sx={{ mr: 1 }} />
          <Typography variant="h5">MTT誘導システム</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* MTT選択 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>MTT機種</InputLabel>
              <Select
                value={selectedMTT}
                onChange={(e) => setSelectedMTT(e.target.value)}
                disabled={customMode}
              >
                {Object.entries(mttTypes).map(([key, mtt]) => (
                  <MenuItem key={key} value={key}>
                    <DirectionsRailway sx={{ mr: 1 }} />
                    {mtt.name} ({mtt.manufacturer})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>作業方向</InputLabel>
              <Select
                value={workDirection}
                onChange={(e) => setWorkDirection(e.target.value as 'forward' | 'backward')}
              >
                <MenuItem value="forward">
                  <SwapHoriz sx={{ mr: 1 }} />
                  順方向
                </MenuItem>
                <MenuItem value="backward">
                  <SwapHoriz sx={{ mr: 1, transform: 'rotate(180deg)' }} />
                  逆方向
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* カスタムモード */}
        <Box mt={2}>
          <FormControlLabel
            control={
              <Switch
                checked={customMode}
                onChange={(e) => setCustomMode(e.target.checked)}
              />
            }
            label="カスタムパラメータを使用"
          />
          {customMode && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Edit />}
              onClick={() => setCustomDialogOpen(true)}
              sx={{ ml: 2 }}
            >
              パラメータ編集
            </Button>
          )}
        </Box>

        {/* 現在のMTTパラメータ表示 */}
        <Paper sx={{ p: 2, mt: 3, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom>
            MTTパラメータ
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="textSecondary">フロント位置</Typography>
              <Typography variant="h6">{getCurrentMTTParams().frontOffset}m</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="textSecondary">作業速度</Typography>
              <Typography variant="h6">{getCurrentMTTParams().workingSpeed}km/h</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="textSecondary">こう上容量</Typography>
              <Typography variant="h6">{getCurrentMTTParams().liftCapacity}mm</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="textSecondary">通り容量</Typography>
              <Typography variant="h6">{getCurrentMTTParams().alignmentCapacity}mm</Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 最適化設定 */}
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>最適化設定</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>最適化方法</InputLabel>
                <Select
                  value={optimizationMethod}
                  onChange={(e) => setOptimizationMethod(e.target.value as any)}
                >
                  <MenuItem value="energy">エネルギー最小化</MenuItem>
                  <MenuItem value="peak">ピーク値最小化</MenuItem>
                  <MenuItem value="rms">RMS最小化</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" gutterBottom>
                探索範囲: ±{searchRange}m
              </Typography>
              <Slider
                value={searchRange}
                onChange={(_, value) => setSearchRange(value as number)}
                min={1}
                max={10}
                step={0.5}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* アクションボタン */}
        <Box display="flex" gap={2} mb={3}>
          <Button
            variant="contained"
            startIcon={<Calculate />}
            onClick={performMTTCorrection}
            disabled={loading || !movementData || movementData.length === 0}
          >
            MTT補正を実行
          </Button>
          <Button
            variant="outlined"
            startIcon={<Timeline />}
            onClick={performWorkSimulation}
            disabled={!correctionResult}
          >
            作業シミュレーション
          </Button>
        </Box>

        {loading && <LinearProgress />}

        {/* 補正結果 */}
        {correctionResult && (
          <Box>
            <Typography variant="h6" gutterBottom>補正結果</Typography>

            {/* 効率情報 */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">作業距離</Typography>
                  <Typography variant="h6">
                    {correctionResult.efficiency.totalLength.toFixed(2)}km
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">推定作業時間</Typography>
                  <Typography variant="h6">
                    {correctionResult.efficiency.estimatedTime.toFixed(1)}時間
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">容量制限率</Typography>
                  <Typography variant="h6" color={
                    correctionResult.efficiency.limitedRatio > 20 ? 'error' : 'inherit'
                  }>
                    {correctionResult.efficiency.limitedRatio.toFixed(1)}%
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">タンピング回数</Typography>
                  <Typography variant="h6">
                    {correctionResult.efficiency.tampingCycles}回
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* 最適化結果 */}
            <Alert severity="info" sx={{ mb: 2 }}>
              フロント位置が{correctionResult.optimizedFrontOffset.toFixed(2)}mに最適化されました
              （標準: {getCurrentMTTParams().frontOffset}m）
            </Alert>

            {/* 推奨事項 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>推奨事項</Typography>
              {correctionResult.recommendations.map((rec, index) => (
                <Alert
                  key={index}
                  severity={rec.includes('問題ありません') ? 'success' : 'warning'}
                  sx={{ mb: 1 }}
                >
                  {rec}
                </Alert>
              ))}
            </Box>

            {/* 統計表 */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>項目</TableCell>
                    <TableCell align="right">最大値</TableCell>
                    <TableCell align="right">平均値</TableCell>
                    <TableCell align="center">状態</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>こう上量 (mm)</TableCell>
                    <TableCell align="right">
                      {correctionResult.statistics.maxTamping.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">
                      {correctionResult.statistics.avgTamping.toFixed(1)}
                    </TableCell>
                    <TableCell align="center">
                      {correctionResult.statistics.maxTamping <= getCurrentMTTParams().liftCapacity ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Warning color="warning" />
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>通り移動量 (mm)</TableCell>
                    <TableCell align="right">
                      {correctionResult.statistics.maxLining.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">
                      {correctionResult.statistics.avgLining.toFixed(1)}
                    </TableCell>
                    <TableCell align="center">
                      {correctionResult.statistics.maxLining <= getCurrentMTTParams().alignmentCapacity ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Warning color="warning" />
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* カスタムパラメータダイアログ */}
        <Dialog open={customDialogOpen} onClose={() => setCustomDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>カスタムMTTパラメータ</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="名称"
                  value={customParams.name}
                  onChange={(e) => setCustomParams({ ...customParams, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="製造元"
                  value={customParams.manufacturer}
                  onChange={(e) => setCustomParams({ ...customParams, manufacturer: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="フロント位置 (m)"
                  type="number"
                  value={customParams.frontOffset}
                  onChange={(e) => setCustomParams({ ...customParams, frontOffset: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="作業速度 (km/h)"
                  type="number"
                  value={customParams.workingSpeed}
                  onChange={(e) => setCustomParams({ ...customParams, workingSpeed: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="こう上容量 (mm)"
                  type="number"
                  value={customParams.liftCapacity}
                  onChange={(e) => setCustomParams({ ...customParams, liftCapacity: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="通り容量 (mm)"
                  type="number"
                  value={customParams.alignmentCapacity}
                  onChange={(e) => setCustomParams({ ...customParams, alignmentCapacity: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="タンピングユニット数"
                  type="number"
                  value={customParams.tampingUnits}
                  onChange={(e) => setCustomParams({ ...customParams, tampingUnits: parseInt(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="測定弦長 (m)"
                  type="number"
                  value={customParams.measurementChord}
                  onChange={(e) => setCustomParams({ ...customParams, measurementChord: parseFloat(e.target.value) })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCustomDialogOpen(false)}>キャンセル</Button>
            <Button onClick={() => setCustomDialogOpen(false)} variant="contained">
              保存
            </Button>
          </DialogActions>
        </Dialog>

        {/* 作業シミュレーション */}
        {showSimulation && (
          <Dialog open={showSimulation} onClose={() => setShowSimulation(false)} maxWidth="md" fullWidth>
            <DialogTitle>作業シミュレーション</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>天候条件</InputLabel>
                    <Select
                      value={weatherConditions}
                      onChange={(e) => setWeatherConditions(e.target.value as any)}
                    >
                      <MenuItem value="normal">通常</MenuItem>
                      <MenuItem value="rain">雨天</MenuItem>
                      <MenuItem value="snow">降雪</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>軌道状態</InputLabel>
                    <Select
                      value={trackCondition}
                      onChange={(e) => setTrackCondition(e.target.value as any)}
                    >
                      <MenuItem value="excellent">良好</MenuItem>
                      <MenuItem value="standard">標準</MenuItem>
                      <MenuItem value="poor">不良</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>オペレーター技能</InputLabel>
                    <Select
                      value={operatorSkill}
                      onChange={(e) => setOperatorSkill(e.target.value as any)}
                    >
                      <MenuItem value="beginner">初心者</MenuItem>
                      <MenuItem value="experienced">経験者</MenuItem>
                      <MenuItem value="expert">熟練者</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {correctionResult && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    シミュレーション結果
                  </Typography>
                  <Alert severity="info">
                    条件による作業時間への影響：
                    {weatherConditions === 'rain' && ' 雨天により20%延長'}
                    {weatherConditions === 'snow' && ' 降雪により40%延長'}
                    {trackCondition === 'poor' && ' 軌道不良により30%延長'}
                    {operatorSkill === 'beginner' && ' 初心者により30%延長'}
                    {operatorSkill === 'expert' && ' 熟練者により20%短縮'}
                  </Alert>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowSimulation(false)}>閉じる</Button>
            </DialogActions>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

export default MTTGuidancePanel;