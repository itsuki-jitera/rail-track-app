/**
 * 相関マッチングコンポーネント
 * 手検測データとチャートデータの相関を計算し、最適な位置合わせを行う
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  TextField,
  LinearProgress,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine,
  Area
} from 'recharts';
import {
  CompareArrows,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Add,
  Delete,
  TrendingUp
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface FieldMeasurement {
  id?: number;
  name: string;
  positions: number[];
  values: number[];
  location?: string;
}

interface ChartData {
  positions: number[];
  values: number[];
}

interface MatchResult {
  bestOffset: number;
  bestCorrelation: number;
  quality: string;
  recommendation: string[];
  matchPosition: {
    chartStart: number;
    chartEnd: number;
  };
  correlationResults?: Array<{
    offset: number;
    correlation: number;
  }>;
}

interface Props {
  chartData?: ChartData;
  onMatchComplete?: (result: MatchResult) => void;
}

const CorrelationMatcher: React.FC<Props> = ({ chartData, onMatchComplete }) => {
  const [fieldMeasurements, setFieldMeasurements] = useState<FieldMeasurement[]>([
    {
      id: 1,
      name: '手検測データ1',
      positions: [],
      values: [],
      location: ''
    }
  ]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [globalResult, setGlobalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRange, setSearchRange] = useState(20);
  const [correlationThreshold, setCorrelationThreshold] = useState(0.7);
  const [showCorrelationMap, setShowCorrelationMap] = useState(true);
  const [selectedMeasurement, setSelectedMeasurement] = useState<number>(0);

  // フィールド測定データを追加
  const addFieldMeasurement = () => {
    const newMeasurement: FieldMeasurement = {
      id: fieldMeasurements.length + 1,
      name: `手検測データ${fieldMeasurements.length + 1}`,
      positions: [],
      values: [],
      location: ''
    };
    setFieldMeasurements([...fieldMeasurements, newMeasurement]);
  };

  // フィールド測定データを削除
  const removeFieldMeasurement = (index: number) => {
    const newMeasurements = [...fieldMeasurements];
    newMeasurements.splice(index, 1);
    setFieldMeasurements(newMeasurements);
  };

  // CSVデータをパース
  const parseCSVData = (csvText: string, index: number) => {
    try {
      const lines = csvText.trim().split('\n');
      const positions: number[] = [];
      const values: number[] = [];

      lines.forEach(line => {
        const [pos, val] = line.split(',').map(v => parseFloat(v.trim()));
        if (!isNaN(pos) && !isNaN(val)) {
          positions.push(pos);
          values.push(val);
        }
      });

      const newMeasurements = [...fieldMeasurements];
      newMeasurements[index] = {
        ...newMeasurements[index],
        positions,
        values
      };
      setFieldMeasurements(newMeasurements);

      return true;
    } catch (err) {
      setError('CSVデータの解析に失敗しました');
      return false;
    }
  };

  // 単一測定点のマッチング
  const performSingleMatch = async () => {
    if (!chartData || fieldMeasurements.length === 0) {
      setError('チャートデータと手検測データが必要です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results: MatchResult[] = [];

      for (const measurement of fieldMeasurements) {
        if (measurement.positions.length === 0) continue;

        const response = await axios.post(`${API_BASE_URL}/api/restoration/correlation-match`, {
          chartData,
          fieldData: {
            positions: measurement.positions,
            values: measurement.values
          },
          options: {
            searchRange,
            correlationThreshold,
            stepSize: 0.25
          }
        });

        if (response.data.success) {
          results.push(response.data);
        }
      }

      setMatchResults(results);

      if (results.length > 0 && onMatchComplete) {
        onMatchComplete(results[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '相関マッチングに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 複数測定点の統合マッチング
  const performMultiPointMatch = async () => {
    if (!chartData || fieldMeasurements.length < 2) {
      setError('複数の手検測データが必要です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const validMeasurements = fieldMeasurements
        .filter(m => m.positions.length > 0)
        .map(m => ({
          positions: m.positions,
          values: m.values
        }));

      const response = await axios.post(`${API_BASE_URL}/api/restoration/multi-point-match`, {
        chartData,
        multipleFieldData: validMeasurements,
        options: {
          searchRange,
          correlationThreshold
        }
      });

      if (response.data.success) {
        setGlobalResult(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '複数点マッチングに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 相関係数の可視化データを準備
  const prepareCorrelationData = () => {
    if (!matchResults[selectedMeasurement]?.correlationResults) return [];

    return matchResults[selectedMeasurement].correlationResults.map(r => ({
      offset: r.offset,
      correlation: r.correlation * 100,
      threshold: correlationThreshold * 100
    }));
  };

  // 品質評価の色を取得
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return '#4CAF50';
      case 'very_good': return '#8BC34A';
      case 'good': return '#CDDC39';
      case 'acceptable': return '#FFC107';
      case 'poor': return '#FF9800';
      default: return '#F44336';
    }
  };

  // 相関係数の色を取得
  const getCorrelationColor = (correlation: number) => {
    if (correlation >= 0.95) return '#4CAF50';
    if (correlation >= 0.9) return '#8BC34A';
    if (correlation >= 0.8) return '#CDDC39';
    if (correlation >= 0.7) return '#FFC107';
    if (correlation >= 0.5) return '#FF9800';
    return '#F44336';
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <CompareArrows sx={{ mr: 1 }} />
          <Typography variant="h5">手検測データ相関マッチング</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 設定パネル */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>マッチング設定</Typography>
            <Box sx={{ px: 2 }}>
              <Typography variant="body2">検索範囲: ±{searchRange}m</Typography>
              <Slider
                value={searchRange}
                onChange={(_, value) => setSearchRange(value as number)}
                min={5}
                max={50}
                step={5}
                marks
                valueLabelDisplay="auto"
              />

              <Typography variant="body2">相関係数閾値: {correlationThreshold}</Typography>
              <Slider
                value={correlationThreshold}
                onChange={(_, value) => setCorrelationThreshold(value as number)}
                min={0.5}
                max={0.95}
                step={0.05}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography gutterBottom>表示オプション</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showCorrelationMap}
                  onChange={(e) => setShowCorrelationMap(e.target.checked)}
                />
              }
              label="相関マップを表示"
            />
          </Grid>
        </Grid>

        {/* 手検測データ入力 */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">手検測データ</Typography>
            <Button
              startIcon={<Add />}
              onClick={addFieldMeasurement}
              variant="outlined"
              size="small"
            >
              測定点を追加
            </Button>
          </Box>

          {fieldMeasurements.map((measurement, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="測定名"
                    value={measurement.name}
                    onChange={(e) => {
                      const newMeasurements = [...fieldMeasurements];
                      newMeasurements[index].name = e.target.value;
                      setFieldMeasurements(newMeasurements);
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="測定位置"
                    value={measurement.location}
                    onChange={(e) => {
                      const newMeasurements = [...fieldMeasurements];
                      newMeasurements[index].location = e.target.value;
                      setFieldMeasurements(newMeasurements);
                    }}
                    placeholder="例: 2k500m"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    label="CSVデータ（位置,値）"
                    placeholder="0,1.5&#10;0.25,1.8&#10;0.5,2.1"
                    onChange={(e) => parseCSVData(e.target.value, index)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Box display="flex" gap={1}>
                    {measurement.positions.length > 0 && (
                      <Chip
                        label={`${measurement.positions.length}点`}
                        size="small"
                        color="primary"
                      />
                    )}
                    <Button
                      size="small"
                      color="error"
                      onClick={() => removeFieldMeasurement(index)}
                      disabled={fieldMeasurements.length === 1}
                    >
                      <Delete />
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Box>

        {/* 実行ボタン */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={performSingleMatch}
            disabled={loading || !chartData || fieldMeasurements.every(m => m.positions.length === 0)}
            startIcon={<TrendingUp />}
          >
            単一点マッチング
          </Button>
          {fieldMeasurements.length > 1 && (
            <Button
              variant="outlined"
              onClick={performMultiPointMatch}
              disabled={loading || !chartData || fieldMeasurements.filter(m => m.positions.length > 0).length < 2}
            >
              複数点統合マッチング
            </Button>
          )}
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* マッチング結果 */}
        {matchResults.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>マッチング結果</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>測定名</TableCell>
                    <TableCell align="right">最適オフセット</TableCell>
                    <TableCell align="right">相関係数</TableCell>
                    <TableCell align="center">品質</TableCell>
                    <TableCell>推奨事項</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matchResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>{fieldMeasurements[index]?.name}</TableCell>
                      <TableCell align="right">{result.bestOffset.toFixed(2)}m</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${(result.bestCorrelation * 100).toFixed(1)}%`}
                          size="small"
                          style={{
                            backgroundColor: getCorrelationColor(result.bestCorrelation),
                            color: '#fff'
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={result.quality}
                          size="small"
                          style={{
                            backgroundColor: getQualityColor(result.quality),
                            color: '#fff'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {result.recommendation.map((rec, i) => (
                          <Typography key={i} variant="body2">
                            • {rec}
                          </Typography>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* 相関マップ */}
        {showCorrelationMap && matchResults.length > 0 && matchResults[selectedMeasurement]?.correlationResults && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              相関マップ - {fieldMeasurements[selectedMeasurement]?.name}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={prepareCorrelationData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="offset"
                  label={{ value: 'オフセット (m)', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis
                  label={{ value: '相関係数 (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />

                <ReferenceLine
                  y={correlationThreshold * 100}
                  stroke="#FF9800"
                  strokeDasharray="5 5"
                  label="閾値"
                />

                <Area
                  type="monotone"
                  dataKey="correlation"
                  fill="#2196F3"
                  stroke="#1976D2"
                  fillOpacity={0.6}
                  name="相関係数"
                />

                <ReferenceLine
                  x={matchResults[selectedMeasurement].bestOffset}
                  stroke="#4CAF50"
                  strokeWidth={2}
                  label="最適位置"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* 複数点統合結果 */}
        {globalResult && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>複数点統合マッチング結果</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">グローバルオフセット</Typography>
                <Typography variant="h6">{globalResult.globalOffset.toFixed(2)}m</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">平均相関係数</Typography>
                <Typography variant="h6">
                  {(globalResult.averageCorrelation * 100).toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">残差標準偏差</Typography>
                <Typography variant="h6">{globalResult.residualStdDev.toFixed(2)}m</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">品質評価</Typography>
                <Chip
                  label={globalResult.quality}
                  style={{
                    backgroundColor: getQualityColor(globalResult.quality),
                    color: '#fff'
                  }}
                />
              </Grid>
            </Grid>

            {globalResult.recommendation && globalResult.recommendation.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>推奨事項</Typography>
                {globalResult.recommendation.map((rec: string, index: number) => (
                  <Typography key={index} variant="body2">
                    • {rec}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CorrelationMatcher;