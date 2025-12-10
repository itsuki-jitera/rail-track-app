/**
 * MTT設定パネルコンポーネント
 * MTT機種選択、補正設定、作業区間設定を管理
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  Button,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import { Settings, Train, Construction } from '@mui/icons-material';

interface MTTType {
  value: string;
  label: string;
  config: {
    leveling: {
      bcLength: number;
      cdLength: number;
    };
    lining: {
      bcLength: number;
      cdLength: number;
    };
  };
}

interface WorkSectionData {
  lineName: string;
  lineDirection: string;
  workDirection: string;
  startPosition: number;
  endPosition: number;
  bufferBefore: number;
  bufferAfter: number;
  mttType: string;
}

interface MTTSettingsPanelProps {
  onSettingsChange: (settings: any) => void;
  initialSettings?: any;
}

const MTTSettingsPanel: React.FC<MTTSettingsPanelProps> = ({
  onSettingsChange,
  initialSettings
}) => {
  // MTT機種設定
  const [mttTypes, setMttTypes] = useState<MTTType[]>([]);
  const [selectedMTT, setSelectedMTT] = useState<string>('08-16');
  const [mttConfig, setMttConfig] = useState<any>(null);

  // 補正設定
  const [levelingCorrection, setLevelingCorrection] = useState(true);
  const [liningCorrection, setLiningCorrection] = useState(true);
  const [correctionRate, setCorrectionRate] = useState(1.0);

  // 作業区間設定
  const [workSection, setWorkSection] = useState<WorkSectionData>({
    lineName: '',
    lineDirection: 'down',
    workDirection: 'forward',
    startPosition: 0,
    endPosition: 0,
    bufferBefore: 500,
    bufferAfter: 500,
    mttType: '08-16'
  });

  // データ間隔設定
  const [dataInterval, setDataInterval] = useState<number>(5);

  // エラー表示
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // MTT機種一覧を取得
  useEffect(() => {
    fetchMTTTypes();
  }, []);

  const fetchMTTTypes = async () => {
    try {
      const response = await fetch('/api/mtt-types');
      const data = await response.json();
      if (data.success) {
        setMttTypes(data.data);
      }
    } catch (error) {
      console.error('MTT機種の取得に失敗:', error);
    }
  };

  // MTT機種変更時の処理
  const handleMTTChange = async (mttType: string) => {
    setSelectedMTT(mttType);
    setWorkSection({ ...workSection, mttType });

    // 機種詳細を取得
    try {
      const response = await fetch(`/api/mtt-types/${mttType}`);
      const data = await response.json();
      if (data.success) {
        setMttConfig(data.data);
      }
    } catch (error) {
      console.error('MTT機種詳細の取得に失敗:', error);
    }

    notifySettingsChange();
  };

  // 作業区間の検証
  const validateWorkSection = () => {
    const newErrors: string[] = [];
    const newWarnings: string[] = [];

    // 作業区間の順序チェック
    if (workSection.startPosition >= workSection.endPosition) {
      newErrors.push('作業開始位置が終了位置より後になっています');
    }

    // バッファサイズチェック
    if (workSection.bufferBefore < 500) {
      newWarnings.push('前方バッファが推奨値（500m）より小さいです');
    }
    if (workSection.bufferAfter < 500) {
      newWarnings.push('後方バッファが推奨値（500m）より小さいです');
    }

    setErrors(newErrors);
    setWarnings(newWarnings);

    return newErrors.length === 0;
  };

  // 設定変更を通知
  const notifySettingsChange = () => {
    const settings = {
      mtt: {
        type: selectedMTT,
        config: mttConfig
      },
      correction: {
        leveling: levelingCorrection,
        lining: liningCorrection,
        rate: correctionRate
      },
      workSection: workSection,
      dataInterval: dataInterval
    };

    onSettingsChange(settings);
  };

  // 作業区間データの変更
  const handleWorkSectionChange = (field: keyof WorkSectionData, value: any) => {
    const newWorkSection = { ...workSection, [field]: value };
    setWorkSection(newWorkSection);
    validateWorkSection();
    notifySettingsChange();
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* MTT機種設定 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Train sx={{ mr: 1, verticalAlign: 'middle' }} />
                MTT機種設定
              </Typography>
              <Divider sx={{ my: 2 }} />

              <FormControl fullWidth margin="normal">
                <InputLabel>MTT機種</InputLabel>
                <Select
                  value={selectedMTT}
                  onChange={(e) => handleMTTChange(e.target.value)}
                  label="MTT機種"
                >
                  {mttTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {mttConfig && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    弦長設定
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        レベリング
                      </Typography>
                      <Typography variant="body2">
                        BC間: {mttConfig.leveling.bcLength}m
                      </Typography>
                      <Typography variant="body2">
                        CD間: {mttConfig.leveling.cdLength}m
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        ライニング
                      </Typography>
                      <Typography variant="body2">
                        BC間: {mttConfig.lining.bcLength}m
                      </Typography>
                      <Typography variant="body2">
                        CD間: {mttConfig.lining.cdLength}m
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 移動量補正設定 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
                移動量補正設定
              </Typography>
              <Divider sx={{ my: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={levelingCorrection}
                    onChange={(e) => {
                      setLevelingCorrection(e.target.checked);
                      notifySettingsChange();
                    }}
                  />
                }
                label="レベリング補正"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={liningCorrection}
                    onChange={(e) => {
                      setLiningCorrection(e.target.checked);
                      notifySettingsChange();
                    }}
                  />
                }
                label="ライニング補正"
              />

              <TextField
                fullWidth
                margin="normal"
                label="補正率"
                type="number"
                value={correctionRate}
                onChange={(e) => {
                  setCorrectionRate(parseFloat(e.target.value));
                  notifySettingsChange();
                }}
                inputProps={{ step: 0.01, min: 0.5, max: 1.5 }}
                helperText="通常は1.0のまま使用"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>データ間隔</InputLabel>
                <Select
                  value={dataInterval}
                  onChange={(e) => {
                    setDataInterval(Number(e.target.value));
                    notifySettingsChange();
                  }}
                  label="データ間隔"
                >
                  <MenuItem value={0.5}>0.5m</MenuItem>
                  <MenuItem value={1}>1m</MenuItem>
                  <MenuItem value={5}>5m</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* 作業区間設定 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Construction sx={{ mr: 1, verticalAlign: 'middle' }} />
                作業区間設定
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="線名"
                    value={workSection.lineName}
                    onChange={(e) => handleWorkSectionChange('lineName', e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>線別</InputLabel>
                    <Select
                      value={workSection.lineDirection}
                      onChange={(e) => handleWorkSectionChange('lineDirection', e.target.value)}
                      label="線別"
                    >
                      <MenuItem value="up">上り</MenuItem>
                      <MenuItem value="down">下り</MenuItem>
                      <MenuItem value="single">単線</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>作業方向</InputLabel>
                    <Select
                      value={workSection.workDirection}
                      onChange={(e) => handleWorkSectionChange('workDirection', e.target.value)}
                      label="作業方向"
                    >
                      <MenuItem value="forward">下り方向</MenuItem>
                      <MenuItem value="backward">上り方向</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="作業開始位置(m)"
                    type="number"
                    value={workSection.startPosition}
                    onChange={(e) => handleWorkSectionChange('startPosition', Number(e.target.value))}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="作業終了位置(m)"
                    type="number"
                    value={workSection.endPosition}
                    onChange={(e) => handleWorkSectionChange('endPosition', Number(e.target.value))}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="前方バッファ(m)"
                    type="number"
                    value={workSection.bufferBefore}
                    onChange={(e) => handleWorkSectionChange('bufferBefore', Number(e.target.value))}
                    helperText="推奨: 500m以上"
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="後方バッファ(m)"
                    type="number"
                    value={workSection.bufferAfter}
                    onChange={(e) => handleWorkSectionChange('bufferAfter', Number(e.target.value))}
                    helperText="推奨: 500m以上"
                  />
                </Grid>
              </Grid>

              {/* エラー・警告表示 */}
              {errors.length > 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </Alert>
              )}

              {warnings.length > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {warnings.map((warning, index) => (
                    <div key={index}>{warning}</div>
                  ))}
                </Alert>
              )}

              {/* 作業区間サマリー */}
              {workSection.startPosition > 0 && workSection.endPosition > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    作業区間サマリー
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        作業延長: {workSection.endPosition - workSection.startPosition}m
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        データ取得範囲: {workSection.endPosition - workSection.startPosition + workSection.bufferBefore + workSection.bufferAfter}m
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MTTSettingsPanel;