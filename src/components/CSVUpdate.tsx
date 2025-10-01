import { useState } from 'react';
import { parseShuboCSV, convertExcelDateToJs } from '../utils/dataUtils';
import type { ShuboRawData, CSVUpdateHistory } from '../utils/types';
import { STORAGE_KEYS } from '../utils/types';

interface CSVUpdateProps {
  dataContext: {
    shuboRawData: ShuboRawData[];
    setShuboRawData: (data: ShuboRawData[]) => void;
    configuredShuboData: any[];
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
          shubo_configured_data: localStorage.getItem(STORAGE_KEYS.CONFIGURED_SHUBO_DATA),
          shubo_daily_records: localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS_DATA),
          shubo_tank_config: localStorage.getItem(STORAGE_KEYS.TANK_CONFIG_DATA),
          shubo_analysis_settings: localStorage.getItem(STORAGE_KEYS.ANALYSIS_SETTINGS),
          shubo_csv_update_history: localStorage.getItem(STORAGE_KEYS.CSV_UPDATE_HISTORY),
          shubo_daily_environment: localStorage.getItem(STORAGE_KEYS.DAILY_ENVIRONMENT),
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
              {isProcessing ? '処理中...' : '更新対象を確認'}
            </button>

            {preview && (
              <div className="space-y-4">
                <div className="border border-green-200 bg-green-50 rounded-xl p-4">
                  <h3 className="font-bold text-green-800 mb-2">更新対象（{preview.toUpdate.length}件）</h3>
                  <p className="text-sm text-slate-700">
                    {preview.toUpdate.length > 0 ? preview.toUpdate.join('号、') + '号' : 'なし'}
                  </p>
                </div>

                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                  <h3 className="font-bold text-blue-800 mb-2">保持対象（{preview.toKeep.length}件）</h3>
                  <p className="text-sm text-slate-700">
                    {preview.toKeep.length > 0 ? preview.toKeep.join('号、') + '号' : 'なし'}
                  </p>
                </div>

                <div className="border border-slate-200 bg-slate-50 rounded-xl p-4">
                  <h3 className="font-bold text-slate-800 mb-2">取り込まない（更新日より前の仕込み）（{preview.notImported.length}件）</h3>
                  <p className="text-sm text-slate-600">
                    {preview.notImported.length > 0 ? preview.notImported.join('号、') + '号' : 'なし'}
                  </p>
                </div>

                <button
                  onClick={handleUpdate}
                  disabled={isProcessing}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg transition-all"
                >
                  {isProcessing ? '更新中...' : 'この内容で更新'}
                </button>
              </div>
            )}

          </div>
        </div>

        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-slate-600 px-6 py-3">
              <h3 className="text-lg font-bold text-white">更新履歴</h3>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="px-3 py-2 text-left font-bold">更新日</th>
                    <th className="px-3 py-2 text-left font-bold">実行日時</th>
                    <th className="px-3 py-2 text-right font-bold">更新件数</th>
                    <th className="px-3 py-2 text-right font-bold">保持件数</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
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

      </div>
    </div>
  );
}