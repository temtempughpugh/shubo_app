import { useState } from 'react';
import { loadCSV, parseShuboCSV, convertExcelDateToJs } from '../utils/dataUtils';
import type { ShuboRawData, CSVUpdateHistory } from '../utils/types';
import { STORAGE_KEYS } from '../utils/types';

interface CSVUpdateProps {
  dataContext: {
    shuboRawData: ShuboRawData[];
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
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 更新履歴を取得
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
      
      // ファイルを読み込み
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const csvData = lines.map(line => line.split(','));
      const newShuboData = parseShuboCSV(csvData);

      // 更新日以降の酒母を抽出
      const updateDateObj = new Date(updateDate);
      updateDateObj.setHours(0, 0, 0, 0);

      const toUpdate: number[] = [];
      const toKeep: number[] = [];

      // 既存の設定済み酒母をチェック
      dataContext.configuredShuboData.forEach(config => {
        const startDate = new Date(config.shuboStartDate);
        startDate.setHours(0, 0, 0, 0);
        
        if (startDate >= updateDateObj) {
          toUpdate.push(config.shuboNumber);
        } else {
          toKeep.push(config.shuboNumber);
        }
      });

      // 新規酒母もチェック
      newShuboData.forEach(shubo => {
        const startDate = convertExcelDateToJs(parseFloat(shubo.shuboStartDate));
        startDate.setHours(0, 0, 0, 0);
        
        if (startDate >= updateDateObj && !toUpdate.includes(shubo.shuboNumber)) {
          toUpdate.push(shubo.shuboNumber);
        }
      });

      setPreview({
        toUpdate: toUpdate.sort((a, b) => a - b),
        toKeep: toKeep.sort((a, b) => a - b)
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

      // ファイルを public/data に保存（実際の実装では backend API が必要）
      // ここでは簡易的に、LocalStorageの更新のみ実施

      // 更新対象の ConfiguredShuboData を削除
      const currentConfigured = dataContext.configuredShuboData;
      const filtered = currentConfigured.filter(c => !preview.toUpdate.includes(c.shuboNumber));
      localStorage.setItem(STORAGE_KEYS.CONFIGURED_SHUBO_DATA, JSON.stringify(filtered));

      // 更新対象の DailyRecords を削除
      const dailyRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS_DATA) || '[]');
      const filteredRecords = dailyRecords.filter((r: any) => !preview.toUpdate.includes(r.shuboNumber));
      localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS_DATA, JSON.stringify(filteredRecords));

      // 更新履歴を保存
      const newHistory: CSVUpdateHistory = {
        updateDate: new Date(updateDate),
        executedAt: new Date(),
        updatedCount: preview.toUpdate.length,
        keptCount: preview.toKeep.length
      };
      const updatedHistory = [newHistory, ...history];
      localStorage.setItem(STORAGE_KEYS.CSV_UPDATE_HISTORY, JSON.stringify(updatedHistory));
      setHistory(updatedHistory);

      // データを再読み込み
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
            
            {/* 更新日入力 */}
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

            {/* ファイル選択 */}
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

            {/* プレビューボタン */}
            <button
              onClick={handlePreview}
              disabled={!updateDate || !selectedFile || isProcessing}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg transition-all"
            >
              {isProcessing ? '処理中...' : '更新対象を確認'}
            </button>

            {/* プレビュー結果 */}
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

        {/* 更新履歴 */}
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

      </div>
    </div>
  );
}