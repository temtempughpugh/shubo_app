import { useState } from 'react';
import { parseShuboCSV, convertExcelDateToJs, generateDailyRecords } from '../utils/dataUtils';
import type { ShuboRawData, CSVUpdateHistory, MergedShuboData, DailyRecordData } from '../utils/types';
import { STORAGE_KEYS } from '../utils/types';

interface CSVUpdateProps {
  dataContext: {
    shuboRawData: ShuboRawData[];
    setShuboRawData: (data: ShuboRawData[]) => void;
    configuredShuboData: any[];
    mergedShuboData: MergedShuboData[];
    getDailyRecords: (shuboNumber: number) => DailyRecordData[];
    tankConversionMap: Map<string, any[]>;
    reloadData: () => Promise<void>;
  };
  onClose: () => void;
}

export default function CSVUpdate({ dataContext, onClose }: CSVUpdateProps) {
  const [updateDate, setUpdateDate] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    toUpdate: number[];
    toKeep: number[];
    notImported: number[];
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [history, setHistory] = useState<CSVUpdateHistory[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CSV_UPDATE_HISTORY);
    return saved ? JSON.parse(saved) : [];
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handlePreview = async () => {
    if (!selectedFile || !updateDate) {
      alert('更新日とファイルを選択してください');
      return;
    }

    try {
      setIsProcessing(true);
      
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const csvData = lines.map(line => line.split(','));
      const newShuboData = parseShuboCSV(csvData);

      const updateDateObj = new Date(updateDate);
      updateDateObj.setHours(0, 0, 0, 0);

      const toUpdate: number[] = [];
      const toKeep: number[] = [];

      dataContext.configuredShuboData.forEach(config => {
        const startDate = new Date(config.shuboStartDate);
        startDate.setHours(0, 0, 0, 0);
        
        if (startDate >= updateDateObj) {
          toUpdate.push(config.shuboNumber);
        } else {
          toKeep.push(config.shuboNumber);
        }
      });

      newShuboData.forEach(shubo => {
        const startDate = convertExcelDateToJs(parseFloat(shubo.shuboStartDate));
        startDate.setHours(0, 0, 0, 0);
        
        if (startDate >= updateDateObj && !toUpdate.includes(shubo.shuboNumber)) {
          toUpdate.push(shubo.shuboNumber);
        }
      });

      const newBeforeUpdateDate = newShuboData.filter(shubo => {
        const startDate = convertExcelDateToJs(parseFloat(shubo.shuboStartDate));
        startDate.setHours(0, 0, 0, 0);
        return startDate < updateDateObj;
      });

      setPreview({
        toUpdate: toUpdate.sort((a, b) => a - b),
        toKeep: toKeep.sort((a, b) => a - b),
        notImported: newBeforeUpdateDate.map(s => s.shuboNumber).sort((a, b) => a - b)
      });

    } catch (error) {
      console.error('プレビューエラー:', error);
      alert('ファイルの読み込みに失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdate = async () => {
    if (!preview || !selectedFile || !updateDate) return;

    if (!confirm(`${preview.toUpdate.length}件の酒母を更新し、${preview.toKeep.length}件を保持します。よろしいですか？`)) {
      return;
    }

    try {
      setIsProcessing(true);

      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const csvData = lines.map(line => line.split(','));
      const newShuboData = parseShuboCSV(csvData);

      const updateDateObj = new Date(updateDate);
      updateDateObj.setHours(0, 0, 0, 0);

      const currentShuboData = dataContext.shuboRawData;
      const keptShuboData = currentShuboData.filter(shubo => {
        const startDate = convertExcelDateToJs(parseFloat(shubo.shuboStartDate));
        startDate.setHours(0, 0, 0, 0);
        return startDate < updateDateObj;
      });

      const updatedShuboData = newShuboData.filter(shubo => {
        const startDate = convertExcelDateToJs(parseFloat(shubo.shuboStartDate));
        startDate.setHours(0, 0, 0, 0);
        return startDate >= updateDateObj;
      });

      const mergedShuboData = [...keptShuboData, ...updatedShuboData].sort((a, b) => a.shuboNumber - b.shuboNumber);

      localStorage.setItem(STORAGE_KEYS.SHUBO_RAW_DATA, JSON.stringify(mergedShuboData));
      dataContext.setShuboRawData(mergedShuboData);

      const currentConfigured = dataContext.configuredShuboData;
      const filtered = currentConfigured.filter(c => !preview.toUpdate.includes(c.shuboNumber));
      localStorage.setItem(STORAGE_KEYS.CONFIGURED_SHUBO_DATA, JSON.stringify(filtered));

      const dailyRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS_DATA) || '[]');
      const filteredRecords = dailyRecords.filter((r: any) => !preview.toUpdate.includes(r.shuboNumber));
      localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS_DATA, JSON.stringify(filteredRecords));

      const newHistory: CSVUpdateHistory = {
        updateDate: new Date(updateDate),
        executedAt: new Date(),
        updatedCount: preview.toUpdate.length,
        keptCount: preview.toKeep.length
      };
      const updatedHistory = [newHistory, ...history];
      localStorage.setItem(STORAGE_KEYS.CSV_UPDATE_HISTORY, JSON.stringify(updatedHistory));
      setHistory(updatedHistory);

      await dataContext.reloadData();

      alert('CSV更新が完了しました');
      setPreview(null);
      setSelectedFile(null);
      setUpdateDate('');

    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    try {
      const exportData = {
  exportDate: new Date().toISOString(),
  version: '1.0',
  data: {
    shubo_raw_data: localStorage.getItem(STORAGE_KEYS.SHUBO_RAW_DATA),
    shubo_recipe_data: localStorage.getItem('shubo_recipe_data'),  // 追加
    shubo_configured_data: localStorage.getItem(STORAGE_KEYS.CONFIGURED_SHUBO_DATA),
    shubo_daily_records: localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS_DATA),
    shubo_tank_config: localStorage.getItem(STORAGE_KEYS.TANK_CONFIG_DATA),
    shubo_analysis_settings: localStorage.getItem(STORAGE_KEYS.ANALYSIS_SETTINGS),
    shubo_csv_update_history: localStorage.getItem(STORAGE_KEYS.CSV_UPDATE_HISTORY),
    shubo_daily_environment: localStorage.getItem(STORAGE_KEYS.DAILY_ENVIRONMENT),
    shubo_brewing_preparation: localStorage.getItem(STORAGE_KEYS.BREWING_PREPARATION),  // 追加
    shubo_discharge_schedule: localStorage.getItem(STORAGE_KEYS.DISCHARGE_SCHEDULE),  // 追加
  }
};

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      a.href = url;
      a.download = `shubo_backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      alert('バックアップファイルをダウンロードしました');
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('エクスポートに失敗しました');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('現在のデータは全て上書きされます。続行しますか？')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.data) {
        throw new Error('無効なバックアップファイルです');
      }

      Object.entries(importData.data).forEach(([key, value]) => {
        if (value) {
          localStorage.setItem(key, value as string);
        }
      });

      alert('データを復元しました。ページをリロードします。');
      window.location.reload();
    } catch (error) {
      console.error('インポートエラー:', error);
      alert('インポートに失敗しました。ファイルが正しいか確認してください。');
    } finally {
      e.target.value = '';
    }
  };

  const handleHTMLExport = () => {
  try {
    const shubos = dataContext.mergedShuboData;
    
    if (shubos.length === 0) {
      alert('出力する酒母データがありません');
      return;
    }

    const brewingData = JSON.parse(localStorage.getItem(STORAGE_KEYS.BREWING_PREPARATION) || '{}');
    const dischargeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISCHARGE_SCHEDULE) || '{}');
    const envData = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_ENVIRONMENT) || '{}');

    const html = generateShuboListHTML(
      shubos, 
      dataContext.getDailyRecords,
      brewingData,
      dischargeData,
      envData,
      dataContext.tankConversionMap
    );
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    a.href = url;
    a.download = `酒母一覧_${dateStr}.html`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`${shubos.length}件の酒母データをHTML出力しました`);
  } catch (error) {
    console.error('HTML出力エラー:', error);
    alert('HTML出力に失敗しました');
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">CSV更新</h2>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold transition-all"
            >
              ← 戻る
            </button>
          </div>

          <div className="p-8 space-y-6">
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                更新日（この日以降に仕込む酒母を更新）
              </label>
              <input
                type="date"
                value={updateDate}
                onChange={(e) => setUpdateDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                shubo.csv ファイル
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              onClick={handlePreview}
              disabled={!updateDate || !selectedFile || isProcessing}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg transition-all"
            >
              {isProcessing ? 'プレビュー生成中...' : 'プレビュー'}
            </button>

            {preview && (
              <div className="border border-slate-300 rounded-lg p-6 space-y-4 bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">更新プレビュー</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                    <div className="text-sm text-green-800 font-bold mb-2">更新対象</div>
                    <div className="text-3xl font-bold text-green-700 mb-2">{preview.toUpdate.length}件</div>
                    <div className="text-xs text-green-600 max-h-32 overflow-y-auto">
                      {preview.toUpdate.map(n => `${n}号`).join(', ')}
                    </div>
                  </div>

                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                    <div className="text-sm text-blue-800 font-bold mb-2">保持対象</div>
                    <div className="text-3xl font-bold text-blue-700 mb-2">{preview.toKeep.length}件</div>
                    <div className="text-xs text-blue-600 max-h-32 overflow-y-auto">
                      {preview.toKeep.map(n => `${n}号`).join(', ')}
                    </div>
                  </div>

                  <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
                    <div className="text-sm text-slate-800 font-bold mb-2">除外（新CSV）</div>
                    <div className="text-3xl font-bold text-slate-700 mb-2">{preview.notImported.length}件</div>
                    <div className="text-xs text-slate-600 max-h-32 overflow-y-auto">
                      {preview.notImported.map(n => `${n}号`).join(', ')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleUpdate}
                  disabled={isProcessing}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg transition-all"
                >
                  {isProcessing ? '更新実行中...' : '更新実行'}
                </button>
              </div>
            )}

          </div>
        </div>

        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
              <h2 className="text-2xl font-bold text-white">📋 更新履歴</h2>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-bold text-slate-700">更新日</th>
                    <th className="text-left py-2 px-3 font-bold text-slate-700">実行日時</th>
                    <th className="text-right py-2 px-3 font-bold text-slate-700">更新件数</th>
                    <th className="text-right py-2 px-3 font-bold text-slate-700">保持件数</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">{new Date(h.updateDate).toLocaleDateString('ja-JP')}</td>
                      <td className="px-3 py-2">{new Date(h.executedAt).toLocaleString('ja-JP')}</td>
                      <td className="px-3 py-2 text-right">{h.updatedCount}件</td>
                      <td className="px-3 py-2 text-right">{h.keptCount}件</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">💾 バックアップ・復元</h2>
          </div>

          <div className="p-8 space-y-6">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-purple-200 bg-purple-50 rounded-xl p-4">
                <h3 className="font-bold text-purple-800 mb-3">データエクスポート</h3>
                <p className="text-sm text-slate-600 mb-4">
                  全ての作業データをバックアップファイルとして保存します
                </p>
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-all"
                >
                  📥 エクスポート
                </button>
              </div>

              <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                <h3 className="font-bold text-blue-800 mb-3">データインポート</h3>
                <p className="text-sm text-slate-600 mb-4">
                  バックアップファイルから全データを復元します
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                  id="import-file"
                />
                <label
                  htmlFor="import-file"
                  className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-center cursor-pointer transition-all"
                >
                  📤 インポート
                </label>
              </div>
            </div>

            <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ 注意:</strong> インポートすると現在のデータは全て上書きされます。事前にエクスポートでバックアップを取ることを推奨します。
              </p>
            </div>

          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">📄 酒母一覧HTML出力</h2>
          </div>

          <div className="p-8 space-y-6">
            <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
              <h3 className="font-bold text-orange-800 mb-3">酒母一覧をHTML形式で出力</h3>
              <p className="text-sm text-slate-600 mb-4">
                現在の全酒母データを詳細情報・グラフ・日別記録テーブルを含めてHTML形式で出力します<br/>
                各酒母が1ページ（A4横向き）として印刷・PDF化できます
              </p>
              <div className="text-xs text-slate-500 mb-4">
                出力対象: {dataContext.mergedShuboData.length}件の酒母
              </div>
              <button
                onClick={handleHTMLExport}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-all"
              >
                📥 HTML出力
              </button>
            </div>

            <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
              <p className="text-sm text-blue-800">
                <strong>💡 使い方:</strong> 出力されたHTMLファイルをブラウザで開き、印刷機能（Ctrl+P / Cmd+P）でPDFとして保存できます。印刷設定で「横向き」を選択してください。
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function generateShuboListHTML(
  shubos: MergedShuboData[], 
  getDailyRecords: (shuboNumber: number) => DailyRecordData[],
  brewingData: any,
  dischargeData: any,
  envData: any,
  tankConversionMap: Map<string, any[]>
): string {
  
  const getCapacityFromKensyaku = (tankId: string, kensyaku: number): number | null => {
    const tankData = tankConversionMap.get(tankId);
    if (!tankData) return null;
    const match = tankData.find(d => d.kensyaku === kensyaku);
    return match ? match.capacity : null;
  };

  const formatDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const dateToKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const shuboPages = shubos.map(shubo => {
    let records = getDailyRecords(shubo.primaryNumber);
    
    if (records.length === 0) {
      records = generateDailyRecords(shubo);
    }
    
    const sortedRecords = [...records].sort((a, b) => a.dayNumber - b.dayNumber);
    
    const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
    
   const formatRecipeValue = (field: keyof typeof shubo.recipeData, unit: string) => {
  if (!isDual) return `${shubo.recipeData[field]}${unit}`;
  
  const value1 = shubo.individualRecipeData[0][field];
  const value2 = shubo.individualRecipeData[1][field];
  const total = value1 + value2;
  
  return `${total}(${value1}+${value2})${unit}`;
};

// ここに追加
const totalRiceStr = formatRecipeValue('totalRice', 'kg');
const steamedRiceStr = formatRecipeValue('steamedRice', 'kg');
const kojiRiceStr = formatRecipeValue('kojiRice', 'kg');
const waterStr = formatRecipeValue('water', 'L');
const lacticAcidStr = formatRecipeValue('lacticAcid', 'ml');

    // 仕込み情報
    const brewingInput = brewingData[shubo.primaryNumber];
    const brewingKensyaku = brewingInput?.afterBrewingKensyaku;
    const brewingCapacity = brewingKensyaku ? getCapacityFromKensyaku(shubo.selectedTankId, brewingKensyaku) : null;
    const brewingRatio = brewingCapacity && shubo.recipeData.measurement
      ? ((brewingCapacity / shubo.recipeData.measurement) * 100).toFixed(1)
      : null;

    // 卸し情報
    const dischargeInputArray = shubo.shuboEndDates.map((_, index) => {
      const key = `${shubo.primaryNumber}-${index + 1}`;
      const input = dischargeData[key];
      return input || {
        beforeDischargeKensyaku: null,
        afterDischargeCapacity: null
      };
    });
    
    // グラフ生成
    const graphWidth = 1100;
    const graphHeight = 200;
    const padding = { left: 40, right: 20, top: 20, bottom: 30 };
    
    const tempMax = 30;
    const tempToY = (temp: number) => {
      return padding.top + ((tempMax - temp) / tempMax) * (graphHeight - padding.top - padding.bottom);
    };

    const columnWidths = sortedRecords.map(() => (graphWidth - padding.left - padding.right) / sortedRecords.length);

    let svg = `<svg width="${graphWidth}" height="${graphHeight}" viewBox="0 0 ${graphWidth} ${graphHeight}" preserveAspectRatio="xMidYMid meet" style="background: white; border: 1px solid #cbd5e1;">`;

    for (let temp = 0; temp <= 30; temp += 2) {
      const strokeColor = temp % 10 === 0 ? '#94a3b8' : '#e2e8f0';
      const strokeWidth = temp % 10 === 0 ? 1.5 : 0.5;
      svg += `<line x1="${padding.left}" y1="${tempToY(temp)}" x2="${graphWidth - padding.right}" y2="${tempToY(temp)}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      if (temp % 10 === 0) {
        svg += `<text x="${padding.left - 5}" y="${tempToY(temp)}" text-anchor="end" alignment-baseline="middle" font-size="10" fill="#64748b">${temp}℃</text>`;
      }
    }

    columnWidths.forEach((_, index) => {
      const xPos = padding.left + columnWidths.slice(0, index + 1).reduce((sum, w) => sum + w, 0);
      svg += `<line x1="${xPos}" y1="${padding.top}" x2="${xPos}" y2="${graphHeight - padding.bottom}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    });

    sortedRecords.forEach((record, index) => {
      const colWidth = columnWidths[index];
      const colStart = padding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
      const xCenter = colStart + colWidth / 2;
      svg += `<text x="${xCenter}" y="${graphHeight - 5}" text-anchor="middle" font-size="10" fill="#64748b">${record.dayNumber}</text>`;
    });

    const tempPoints: Array<{ x: number; y: number }> = [];
    sortedRecords.forEach((record, index) => {
      if (record.temperature1 !== null) {
        const colWidth = columnWidths[index];
        const colStart = padding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
        const xPos = colStart + colWidth * 0.3;
        tempPoints.push({ x: xPos, y: tempToY(record.temperature1) });
      }
    });

    if (tempPoints.length > 1) {
      let pathD = `M ${tempPoints[0].x} ${tempPoints[0].y}`;
      for (let i = 1; i < tempPoints.length; i++) {
        pathD += ` L ${tempPoints[i].x} ${tempPoints[i].y}`;
      }
      svg += `<path d="${pathD}" stroke="#3b82f6" stroke-width="2" fill="none"/>`;
    }

    sortedRecords.forEach((record, index) => {
      const colWidth = columnWidths[index];
      const colStart = padding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
      
      if (record.temperature1 !== null) {
        const xPos1 = colStart + colWidth * 0.3;
        svg += `<circle cx="${xPos1}" cy="${tempToY(record.temperature1)}" r="4" fill="#3b82f6" stroke="white" stroke-width="1"/>`;
      }
      
      if (record.temperature2 !== null) {
        const xPos2 = colStart + colWidth * 0.5;
        svg += `<circle cx="${xPos2}" cy="${tempToY(record.temperature2)}" r="4" fill="#10b981" stroke="white" stroke-width="1"/>`;
      }
      
      if (record.temperature3 !== null) {
        const xPos3 = colStart + colWidth * 0.7;
        svg += `<circle cx="${xPos3}" cy="${tempToY(record.temperature3)}" r="4" fill="#fed7aa" stroke="white" stroke-width="1"/>`;
      }
    });

    svg += '</svg>';

    // 卸し情報HTML生成
    let dischargeHTML = '';
    if (dischargeInputArray.length === 0) {
      dischargeHTML = '<div class="info-item" style="color: #94a3b8;">データなし</div>';
    } else {
      dischargeHTML = dischargeInputArray.map((discharge, index) => {
        const beforeCapacity = discharge.beforeDischargeKensyaku 
          ? getCapacityFromKensyaku(shubo.selectedTankId, discharge.beforeDischargeKensyaku)
          : null;
        const afterCapacity = discharge.afterDischargeCapacity;
        const dischargeAmount = beforeCapacity !== null && afterCapacity !== null
          ? beforeCapacity - afterCapacity
          : null;
        
        const kensyakuAfter = '-';

        let html = `<div style="margin-bottom: 2mm;">`;
        html += `<div class="info-item"><span>卸${index + 1}前尺:</span> ${discharge.beforeDischargeKensyaku ? `${discharge.beforeDischargeKensyaku}mm` : '-'}`;
        html += ` <span style="margin-left: 2mm;">/卸${index + 1}前容量:</span> ${beforeCapacity ? `${beforeCapacity}L` : '-'}</div>`;
        
        if (afterCapacity !== null && afterCapacity > 0) {
          html += `<div class="info-item"><span>卸${index + 1}後尺:</span> ${kensyakuAfter}`;
          html += ` <span style="margin-left: 2mm;">/卸${index + 1}後容量:</span> ${afterCapacity}L</div>`;
        }
        
        html += `<div class="info-item"><span>卸${index + 1}量:</span> ${dischargeAmount !== null ? `${dischargeAmount}L` : '-'}</div>`;
        html += `</div>`;
        
        return html;
      }).join('');
    }

    // 気温データ取得
    // 気温データ取得
const getAirTemp = (record: DailyRecordData) => {
  const date = record.recordDate instanceof Date 
    ? record.recordDate 
    : new Date(record.recordDate);
  const dateKey = dateToKey(date);
  const env = envData[dateKey];
  return env?.temperature || '-';
};
    
    return `
      <div class="page">
        <div class="info-section">
          <div class="info-block">
            <h3>基本情報①</h3>
            <div class="info-item"><span>酒母:</span> ${shubo.displayName}</div>
            <div class="info-item"><span>タンク:</span> ${shubo.selectedTankId}</div>
            <div class="info-item"><span>酛種類:</span> ${shubo.shuboType}</div>
            <div class="info-item"><span>仕込規模:</span> ${shubo.originalData[0].brewingScale}kg</div>
            <div class="info-item"><span>酵母:</span> ${shubo.originalData[0].yeast}</div>
          </div>

          <div class="info-block">
            <h3>基本情報②</h3>
            <div class="info-item"><span>仕込区分:</span> ${shubo.originalData[0].brewingCategory}</div>
            <div class="info-item"><span>麹米:</span> ${shubo.originalData[0].kojiRiceVariety}</div>
            <div class="info-item"><span>掛米:</span> ${shubo.originalData[0].kakeRiceVariety}</div>
            <div class="info-item"><span>備考:</span> ${shubo.originalData[0].memo}</div>
          </div>

          <div class="info-block">
  <h3>配合情報</h3>
  <div class="info-item"><span>総米:</span> ${totalRiceStr}</div>
  <div class="info-item"><span>蒸米:</span> ${steamedRiceStr}</div>
  <div class="info-item"><span>麹米:</span> ${kojiRiceStr}</div>
  <div class="info-item"><span>汲み水:</span> ${waterStr}</div>
  <div class="info-item"><span>乳酸:</span> ${lacticAcidStr}</div>
</div>

          <div class="info-block">
            <h3>仕込み情報</h3>
            <div class="info-item"><span>留測尺:</span> ${brewingKensyaku ? `${brewingKensyaku}mm` : '-'}</div>
            <div class="info-item"><span>留測:</span> ${brewingCapacity ? `${brewingCapacity}L` : '-'}</div>
            <div class="info-item"><span>留測歩合:</span> ${brewingRatio ? `${brewingRatio}%` : '-'}</div>
          </div>

          <div class="info-block">
            <h3>卸し情報</h3>
            ${dischargeHTML}
          </div>
        </div>

        <div class="table-header">📊 日別記録テーブル (${sortedRecords.length}日分)</div>
        
        <div class="graph-container">
          ${svg}
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th class="item-header">項目</th>
                ${sortedRecords.map(r => `<th>${r.dayNumber}日</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="item-header">ラベル</td>
                ${sortedRecords.map(r => `<td>${r.dayLabel || '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">日付</td>
                ${sortedRecords.map(r => `<td>${formatDate(r.recordDate)}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">分析日</td>
                ${sortedRecords.map(r => `<td>${r.isAnalysisDay ? '✓' : ''}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">品温①</td>
                ${sortedRecords.map(r => `<td>${r.temperature1 !== null ? r.temperature1 : '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">品温②</td>
                ${sortedRecords.map(r => `<td>${r.temperature2 !== null ? r.temperature2 : '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">品温③(午後)</td>
                ${sortedRecords.map(r => `<td>${r.temperature3 !== null ? r.temperature3 : '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">気温</td>
                ${sortedRecords.map(r => `<td>${getAirTemp(r)}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">ボーメ</td>
                ${sortedRecords.map(r => `<td>${r.baume !== null ? r.baume : '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">ボーメ予測</td>
                ${sortedRecords.map(() => `<td>-</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">酸度</td>
                ${sortedRecords.map(r => `<td>${r.acidity !== null ? r.acidity : '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">アルコール</td>
                ${sortedRecords.map(r => `<td>${r.alcohol !== null ? r.alcohol : '-'}</td>`).join('')}
              </tr>
              <tr>
                <td class="item-header">メモ</td>
                ${sortedRecords.map(r => `<td>${r.memo || '-'}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>酒母一覧 - ${new Date().getFullYear()}/${new Date().getMonth() + 1}/${new Date().getDate()}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Yu Gothic', 'Meiryo', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
    }

    .page {
      width: 277mm;
      min-height: 190mm;
      page-break-after: always;
      padding: 5mm;
      background: white;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .info-section {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3mm;
      margin-bottom: 3mm;
      padding: 3mm;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 2mm;
    }

    .info-block h3 {
      font-size: 8pt;
      font-weight: bold;
      color: #475569;
      margin-bottom: 2mm;
      padding-bottom: 1mm;
      border-bottom: 1px solid #cbd5e1;
    }

    .info-item {
      font-size: 8pt;
      margin-bottom: 1mm;
    }

    .info-item span:first-child {
      color: #64748b;
      margin-right: 2mm;
    }

    .table-header {
      background: #2563eb;
      color: white;
      padding: 2mm 3mm;
      font-weight: bold;
      font-size: 9pt;
      margin-bottom: 2mm;
      border-radius: 1mm;
    }

  .graph-container {
      margin-bottom: 3mm;
      padding: 2mm;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 1mm;
      max-width: 100%;
      overflow-x: hidden;
    }

    .graph-container svg {
      max-width: 100%;
      height: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6pt;
      table-layout: fixed;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 1mm 1.5mm;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    th {
      background: #f1f5f9;
      font-weight: bold;
      color: #1e293b;
    }

    .item-header {
      background: #f8fafc;
      font-weight: bold;
      text-align: left;
      min-width: 20mm;
      position: sticky;
      left: 0;
      z-index: 10;
    }

    tbody tr:nth-child(even) {
      background: #fafafa;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .page {
        margin: 0;
        padding: 5mm;
      }
    }
  </style>
</head>
<body>
  ${shuboPages}
</body>
</html>
  `;
}