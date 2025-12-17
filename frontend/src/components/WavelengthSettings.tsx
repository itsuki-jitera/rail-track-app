/**
 * 波長範囲設定コンポーネント
 * 最高速度と軌道種別に基づいて最適な復元波長範囲を動的に設定
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
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
  TableRow
} from '@mui/material';
import {
  Speed,
  Settings,
  Info,
  Calculate,
  Save,
  RestartAlt,
  TrainOutlined
} from '@mui/icons-material';

interface WavelengthRange {
  lower: number;
  upper: number;
  unit: string;
  mode: string;
  recommendation: string;
}

interface Props {
  onRangeUpdate?: (range: WavelengthRange) => void;
  initialMaxSpeed?: number;
  initialTrackType?: string;
}

const WavelengthSettings: React.FC<Props> = ({
  onRangeUpdate,
  initialMaxSpeed = 130,
  initialTrackType = 'conventional'
}) => {
  // 基本設定
  const [maxSpeed, setMaxSpeed] = useState(initialMaxSpeed);
  const [trackType, setTrackType] = useState(initialTrackType);
  const [measurementType, setMeasurementType] = useState('level');
  const [speedCoefficient, setSpeedCoefficient] = useState(1.75);

  // 詳細オプション
  const [useShorterWavelength, setUseShorterWavelength] = useState(false);
  const [use15mLowerLimit, setUse15mLowerLimit] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customLower, setCustomLower] = useState(6.0);
  const [customUpper, setCustomUpper] = useState(40.0);

  // 計算結果
  const [calculatedRange, setCalculatedRange] = useState<WavelengthRange>({
    lower: 6.0,
    upper: 40.0,
    unit: 'm',
    mode: 'speed_based',
    recommendation: ''
  });

  // プリセット
  const presets = {
    'conventional_standard': {
      name: '在来線標準（130km/h）',
      maxSpeed: 130,
      trackType: 'conventional',
      lower: 6,
      upper: 40
    },
    'conventional_local': {
      name: '在来線普通（85km/h）',
      maxSpeed: 85,
      trackType: 'conventional',
      lower: 6,
      upper: 30
    },
    'shinkansen_standard': {
      name: '新幹線標準（270km/h）',
      maxSpeed: 270,
      trackType: 'shinkansen',
      lower: 6,
      upper: 70
    },
    'shinkansen_max': {
      name: '新幹線最高速（320km/h）',
      maxSpeed: 320,
      trackType: 'shinkansen',
      lower: 6,
      upper: 70
    }
  };

  // 波長範囲の計算
  const calculateWavelengthRange = () => {
    if (customMode) {
      return {
        lower: customLower,
        upper: customUpper,
        unit: 'm',
        mode: 'custom',
        recommendation: 'カスタム設定'
      };
    }

    // 速度から上限を計算
    const speedMs = maxSpeed / 3.6;
    let upperLimit = speedMs * speedCoefficient;

    // 下限の設定
    let lowerLimit = 6.0;

    // 新幹線の特殊設定
    if (trackType === 'shinkansen') {
      if (measurementType === 'level' && useShorterWavelength) {
        lowerLimit = 3.5;
        upperLimit = 6.0;
        return {
          lower: lowerLimit,
          upper: upperLimit,
          unit: 'm',
          mode: 'special_short_wavelength',
          recommendation: '新幹線短波長モード（3.5m-6m）'
        };
      }

      if (measurementType === 'alignment' && use15mLowerLimit) {
        lowerLimit = 15.0;
      }

      upperLimit = Math.min(upperLimit, 70.0);
    } else {
      upperLimit = Math.min(upperLimit, 40.0);
    }

    // 測定項目別の調整
    if (measurementType === 'gauge') {
      upperLimit *= 0.625;
      lowerLimit *= 0.5;
    }

    // 推奨事項の生成
    let recommendation = '';
    if (maxSpeed >= 200) {
      recommendation = '高速区間: 長波長成分を重視した設定';
    } else if (maxSpeed >= 130) {
      recommendation = '準高速区間: バランス型の波長設定';
    } else {
      recommendation = '低速区間: 短波長成分も考慮した設定';
    }

    return {
      lower: Math.round(lowerLimit * 10) / 10,
      upper: Math.round(upperLimit * 10) / 10,
      unit: 'm',
      mode: 'speed_based',
      recommendation
    };
  };

  // 範囲の更新
  useEffect(() => {
    const newRange = calculateWavelengthRange();
    setCalculatedRange(newRange);
    if (onRangeUpdate) {
      onRangeUpdate(newRange);
    }
  }, [maxSpeed, trackType, measurementType, speedCoefficient,
      useShorterWavelength, use15mLowerLimit, customMode, customLower, customUpper]);

  // プリセットの適用
  const applyPreset = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets];
    if (preset) {
      setMaxSpeed(preset.maxSpeed);
      setTrackType(preset.trackType);
      setCustomMode(false);
      setUseShorterWavelength(false);
      setUse15mLowerLimit(false);
    }
  };

  // リセット
  const resetToDefault = () => {
    setMaxSpeed(130);
    setTrackType('conventional');
    setMeasurementType('level');
    setSpeedCoefficient(1.75);
    setCustomMode(false);
    setUseShorterWavelength(false);
    setUse15mLowerLimit(false);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Settings sx={{ mr: 1 }} />
          <Typography variant="h5">波長範囲設定</Typography>
        </Box>

        {/* プリセット選択 */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            クイック設定
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {Object.entries(presets).map(([key, preset]) => (
              <Chip
                key={key}
                label={preset.name}
                onClick={() => applyPreset(key)}
                color={
                  maxSpeed === preset.maxSpeed && trackType === preset.trackType
                    ? 'primary'
                    : 'default'
                }
                variant={
                  maxSpeed === preset.maxSpeed && trackType === preset.trackType
                    ? 'filled'
                    : 'outlined'
                }
              />
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 基本設定 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>
              <Speed sx={{ verticalAlign: 'middle', mr: 1 }} />
              最高速度: {maxSpeed} km/h
            </Typography>
            <Slider
              value={maxSpeed}
              onChange={(_, value) => setMaxSpeed(value as number)}
              min={30}
              max={350}
              step={5}
              marks={[
                { value: 85, label: '85' },
                { value: 130, label: '130' },
                { value: 200, label: '200' },
                { value: 270, label: '270' },
                { value: 320, label: '320' }
              ]}
              valueLabelDisplay="auto"
              disabled={customMode}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>軌道種別</InputLabel>
              <Select
                value={trackType}
                onChange={(e) => setTrackType(e.target.value)}
                disabled={customMode}
              >
                <MenuItem value="conventional">
                  <TrainOutlined sx={{ mr: 1 }} />
                  在来線
                </MenuItem>
                <MenuItem value="shinkansen">
                  <TrainOutlined sx={{ mr: 1 }} />
                  新幹線
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>測定項目</InputLabel>
              <Select
                value={measurementType}
                onChange={(e) => setMeasurementType(e.target.value)}
              >
                <MenuItem value="level">高低</MenuItem>
                <MenuItem value="alignment">通り</MenuItem>
                <MenuItem value="gauge">軌間</MenuItem>
                <MenuItem value="cant">水準</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography gutterBottom>速度係数: {speedCoefficient}</Typography>
            <Slider
              value={speedCoefficient}
              onChange={(_, value) => setSpeedCoefficient(value as number)}
              min={1.5}
              max={2.0}
              step={0.05}
              marks
              valueLabelDisplay="auto"
              disabled={customMode}
            />
          </Grid>
        </Grid>

        {/* 詳細オプション */}
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>詳細オプション</Typography>

          <FormControlLabel
            control={
              <Switch
                checked={customMode}
                onChange={(e) => setCustomMode(e.target.checked)}
              />
            }
            label="カスタム範囲を使用"
          />

          {trackType === 'shinkansen' && measurementType === 'level' && (
            <FormControlLabel
              control={
                <Switch
                  checked={useShorterWavelength}
                  onChange={(e) => setUseShorterWavelength(e.target.checked)}
                  disabled={customMode}
                />
              }
              label="短波長モード（3.5m-6m）を使用"
            />
          )}

          {measurementType === 'alignment' && (
            <FormControlLabel
              control={
                <Switch
                  checked={use15mLowerLimit}
                  onChange={(e) => setUse15mLowerLimit(e.target.checked)}
                  disabled={customMode}
                />
              }
              label="通り15m下限（試行）を使用"
            />
          )}

          {customMode && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="下限波長 (m)"
                  type="number"
                  value={customLower}
                  onChange={(e) => setCustomLower(parseFloat(e.target.value))}
                  inputProps={{ min: 1, max: 50, step: 0.5 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="上限波長 (m)"
                  type="number"
                  value={customUpper}
                  onChange={(e) => setCustomUpper(parseFloat(e.target.value))}
                  inputProps={{ min: 10, max: 200, step: 1 }}
                />
              </Grid>
            </Grid>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* 計算結果 */}
        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            計算結果
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                波長範囲
              </Typography>
              <Typography variant="h5">
                {calculatedRange.lower} - {calculatedRange.upper} {calculatedRange.unit}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                モード
              </Typography>
              <Chip
                label={calculatedRange.mode === 'custom' ? 'カスタム' : '自動計算'}
                color={calculatedRange.mode === 'custom' ? 'warning' : 'primary'}
                size="small"
              />
            </Grid>
          </Grid>

          {calculatedRange.recommendation && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {calculatedRange.recommendation}
              </Typography>
            </Alert>
          )}
        </Paper>

        {/* 参考情報 */}
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>
            <Info sx={{ verticalAlign: 'middle', mr: 1 }} />
            参考情報
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>項目</TableCell>
                  <TableCell>在来線</TableCell>
                  <TableCell>新幹線</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>標準下限</TableCell>
                  <TableCell>6.0m</TableCell>
                  <TableCell>6.0m (3.5m選択可)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>標準上限</TableCell>
                  <TableCell>40.0m</TableCell>
                  <TableCell>70.0m</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>通り試行下限</TableCell>
                  <TableCell>6.0m (15m選択可)</TableCell>
                  <TableCell>15.0m (試行)</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* アクションボタン */}
        <Box mt={3} display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => {
              if (onRangeUpdate) {
                onRangeUpdate(calculatedRange);
              }
            }}
          >
            設定を適用
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartAlt />}
            onClick={resetToDefault}
          >
            デフォルトに戻す
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WavelengthSettings;