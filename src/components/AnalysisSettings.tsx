import { useState, useEffect } from 'react';
import { STORAGE_KEYS, DEFAULT_ANALYSIS_SETTINGS, type AnalysisSettings, type RecipeRawData } from '../utils/types';

interface AnalysisSettingsProps {
  onClose: () => void;
  dataContext: any;  // 追加
}

export default function AnalysisSettings({ onClose, dataContext }: AnalysisSettingsProps) {
  const [settings, setSettings] = useState<AnalysisSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ANALYSIS_SETTINGS);
    return saved ? JSON.parse(saved) : DEFAULT_ANALYSIS_SETTINGS;
  });

  // ========== ここから追加 ==========
  const [recipeData, setRecipeData] = useState<RecipeRawData[]>([]);
  const [selectedScale, setSelectedScale] = useState<number>(400);
  const [selectedType, setSelectedType] = useState<string>('速醸');
  // ========== ここまで追加 ==========
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // 仕込み配合データの読み込み
// 仕込み配合データの読み込み
// 仕込み配合データの読み込み
useEffect(() => {
  const loadRecipeData = async () => {
    // 1. dataContext.recipeRawDataを最優先で確認
    if (dataContext?.recipeRawData && dataContext.recipeRawData.length > 0) {
      setRecipeData(dataContext.recipeRawData);
      if (dataContext.recipeRawData.length > 0) {
        setSelectedScale(dataContext.recipeRawData[0].recipeBrewingScale);
        setSelectedType(dataContext.recipeRawData[0].shuboType);
      }
      return;
    }

    // 2. localStorageを確認
    const saved = localStorage.getItem('shubo_recipe_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      setRecipeData(parsed);
      if (parsed.length > 0) {
        setSelectedScale(parsed[0].recipeBrewingScale);
        setSelectedType(parsed[0].shuboType);
      }
      return;
    }

    // 3. どちらもなければエラー表示（CSVファイルは配置していないので読み込まない）
    console.warn('仕込み配合データが見つかりません');
  };
  
  loadRecipeData();
}, [dataContext?.recipeRawData]);

const handleSaveChanges = async () => {
  // 1. localStorageを更新
  localStorage.setItem('shubo_recipe_data', JSON.stringify(recipeData));
  
  // 2. recipeRawDataを更新
  if (dataContext?.setRecipeRawData) {
    dataContext.setRecipeRawData(recipeData);
  }
  
  // 3. configuredShuboDataを更新
  if (dataContext?.configuredShuboData && dataContext?.setConfiguredShuboData) {
    const updatedConfigured = dataContext.configuredShuboData.map((shubo: any) => {
      const recipe = recipeData.find(r => 
        r.shuboType === shubo.shuboType && 
        r.recipeBrewingScale === shubo.originalData.brewingScale
      );
      if (recipe) {
        return {
          ...shubo,
          recipeData: {
            totalRice: recipe.recipeTotalRice,
            steamedRice: recipe.steamedRice,
            kojiRice: recipe.kojiRice,
            water: recipe.water,
            measurement: recipe.water + recipe.recipeTotalRice,
            lacticAcid: recipe.lacticAcid
          }
        };
      }
      return shubo;
    });
    
    dataContext.setConfiguredShuboData(updatedConfigured);
    
    // 4. mergedShuboDataも即座に更新（これを追加）
    const { createMergedShuboData } = await import('../utils/dataUtils');
    const merged = createMergedShuboData(updatedConfigured);
    if (dataContext?.setMergedShuboData) {
      dataContext.setMergedShuboData(merged);
    }
  }
  
  setHasUnsavedChanges(false);
  alert('変更を保存しました');
};
  // ========== ここまで追加 ==========
  const toggleDay = (type: 'speed' | 'highTemp', day: number) => {
    setSettings(prev => ({
      ...prev,
      [type]: prev[type].includes(day)
        ? prev[type].filter(d => d !== day)
        : [...prev[type], day].sort((a, b) => a - b)
    }));
  };

  const resetToDefault = () => {
    setSettings(DEFAULT_ANALYSIS_SETTINGS);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">分析日設定</h2>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold transition-all"
            >
              ← 戻る
            </button>
          </div>

          <div className="p-8 space-y-8">
            
            {/* 速醸設定 */}
            <div className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">速醸のデフォルト分析日</h3>
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 15 }, (_, i) => i + 2).map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay('speed', day)}
                    className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                      settings.speed.includes(day)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day}日
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                現在の設定: {settings.speed.join(', ')}日目 + 卸日（自動）
              </p>
            </div>

            {/* 高温糖化設定 */}
            <div className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">高温糖化のデフォルト分析日</h3>
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 15 }, (_, i) => i + 2).map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay('highTemp', day)}
                    className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                      settings.highTemp.includes(day)
                        ? 'bg-orange-600 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day}日
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                現在の設定: {settings.highTemp.join(', ')}日目 + 卸日（自動）
              </p>
            </div>

            {/* 注意事項 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-slate-700">
                <span className="font-bold">📌 注意:</span> 
                この設定は新規レコード生成時のデフォルト値です。既存のレコードには影響しません。
                卸日は常に分析日として自動設定されます。
              </p>
            </div>

            {/* リセットボタン */}
            <div className="text-center">
              <button
                onClick={resetToDefault}
                className="px-6 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-bold shadow-lg transition-all"
              >
                デフォルトに戻す
              </button>
            </div>

            {/* ボーメ予測警告設定 */}
            <div className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">ボーメ予測警告設定</h3>
              
              {/* 1個もと設定 */}
              <div className="mb-6">
                <h4 className="font-bold text-slate-700 mb-3">1個もと</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日1日前:</label>
                    <span className="text-sm text-red-600 font-semibold">常に赤表示</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日2日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge2High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge2High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge2Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge2Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日3日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge3High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge3High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge3Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge3Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日4日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge4High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge4High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge4Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge4Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日5日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge5High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge5High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.single.daysBeforeDischarge5Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          single: {
                            ...prev.baumePrediction.single,
                            daysBeforeDischarge5Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                </div>
              </div>

              {/* 2個もと設定 */}
              <div>
                <h4 className="font-bold text-slate-700 mb-3">2個もと</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日1日前:</label>
                    <span className="text-sm text-red-600 font-semibold">常に赤表示</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日2日前:</label>
                    <span className="text-sm text-red-600 font-semibold">常に赤表示</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日3日前:</label>
                    <span className="text-sm text-red-600 font-semibold">常に赤表示</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日4日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.dual.daysBeforeDischarge4High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          dual: {
                            ...prev.baumePrediction.dual,
                            daysBeforeDischarge4High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.dual.daysBeforeDischarge4Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          dual: {
                            ...prev.baumePrediction.dual,
                            daysBeforeDischarge4Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日5日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.dual.daysBeforeDischarge5High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          dual: {
                            ...prev.baumePrediction.dual,
                            daysBeforeDischarge5High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.dual.daysBeforeDischarge5Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          dual: {
                            ...prev.baumePrediction.dual,
                            daysBeforeDischarge5Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-slate-600">卸日6日前:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.dual.daysBeforeDischarge6High}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          dual: {
                            ...prev.baumePrediction.dual,
                            daysBeforeDischarge6High: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下でオレンジ、</span>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.baumePrediction.dual.daysBeforeDischarge6Low}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        baumePrediction: {
                          ...prev.baumePrediction,
                          dual: {
                            ...prev.baumePrediction.dual,
                            daysBeforeDischarge6Low: parseFloat(e.target.value)
                          }
                        }
                      }))}
                      className="px-3 py-1 border rounded text-sm w-20"
                    />
                    <span className="text-sm text-slate-600">以下で赤</span>
                  </div>
                </div>
                
              </div>
              
            </div>
{/* 仕込み配合表セクション */}
            <div className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">📋 仕込み配合表</h3>
              
              {/* 規模と種類の選択 */}
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">仕込み規模</label>
                  <select
                    value={selectedScale}
                    onChange={(e) => setSelectedScale(Number(e.target.value))}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from(new Set(recipeData.map(r => r.recipeBrewingScale)))
                      .sort((a, b) => a - b)
                      .map(scale => (
                        <option key={scale} value={scale}>{scale}kg</option>
                      ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">種類</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="速醸">速醸</option>
                    <option value="高温糖化">高温糖化</option>
                  </select>
                </div>
              </div>

              {/* 配合表 */}
{(() => {
  const recipe = recipeData.find(r => 
    r.recipeBrewingScale === selectedScale && r.shuboType === selectedType
  );
  
  if (!recipe) {
    return <p className="text-slate-500 text-center py-4">データがありません</p>;
  }

  // handleCellEditをここで定義（この即時関数の中）
  const handleCellEdit = (field: keyof RecipeRawData, value: string) => {
  const numValue = value === '' ? null : parseFloat(value);
  const updatedRecipes = recipeData.map(r => {
    if (r.recipeBrewingScale === selectedScale && r.shuboType === selectedType) {
      const updated = { ...r, [field]: numValue };
      
      // 汲み水または総米が変更された場合、measurementを再計算
      if (field === 'water' || field === 'recipeTotalRice') {
        const water = field === 'water' ? (numValue ?? 0) : (updated.water ?? 0);
        const totalRice = field === 'recipeTotalRice' ? (numValue ?? 0) : (updated.recipeTotalRice ?? 0);
        updated.measurement = water + totalRice;
      }
      
      return updated;
    }
    return r;
  });
  
  setRecipeData(updatedRecipes);
  setHasUnsavedChanges(true);
};


  return (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-4 py-2 text-left font-bold"></th>
                          <th className="border border-slate-300 px-4 py-2 text-center font-bold">酒母</th>
                          <th className="border border-slate-300 px-4 py-2 text-center font-bold">初添</th>
                          <th className="border border-slate-300 px-4 py-2 text-center font-bold">仲添</th>
                          <th className="border border-slate-300 px-4 py-2 text-center font-bold">留添</th>
                          <th className="border border-slate-300 px-4 py-2 text-center font-bold bg-slate-200">総米</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 総米 */}
                        <tr>
                          <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50">総米</td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.recipeTotalRice}
                              onChange={(e) => handleCellEdit('recipeTotalRice', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.初添_総米 ?? ''}
                              onChange={(e) => handleCellEdit('初添_総米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.仲添_総米 ?? ''}
                              onChange={(e) => handleCellEdit('仲添_総米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.留添_総米 ?? ''}
                              onChange={(e) => handleCellEdit('留添_総米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center font-bold bg-slate-100">
                            {(recipe.recipeTotalRice || 0) + 
                             (recipe.初添_総米 || 0) + 
                             (recipe.仲添_総米 || 0) + 
                             (recipe.留添_総米 || 0)}
                          </td>
                        </tr>

                        {/* 掛米 */}
                        <tr>
                          <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50">掛米</td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.steamedRice}
                              onChange={(e) => handleCellEdit('steamedRice', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.初添_掛米 ?? ''}
                              onChange={(e) => handleCellEdit('初添_掛米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.仲添_掛米 ?? ''}
                              onChange={(e) => handleCellEdit('仲添_掛米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.留添_掛米 ?? ''}
                              onChange={(e) => handleCellEdit('留添_掛米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center font-bold bg-slate-100">
                            {(recipe.steamedRice || 0) + 
                             (recipe.初添_掛米 || 0) + 
                             (recipe.仲添_掛米 || 0) + 
                             (recipe.留添_掛米 || 0)}
                          </td>
                        </tr>

                        {/* 麹米 */}
                        <tr>
                          <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50">麹米</td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.kojiRice}
                              onChange={(e) => handleCellEdit('kojiRice', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.初添_麹米 ?? ''}
                              onChange={(e) => handleCellEdit('初添_麹米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.仲添_麹米 ?? ''}
                              onChange={(e) => handleCellEdit('仲添_麹米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.留添_麹米 ?? ''}
                              onChange={(e) => handleCellEdit('留添_麹米', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center font-bold bg-slate-100">
                            {(recipe.kojiRice || 0) + 
                             (recipe.初添_麹米 || 0) + 
                             (recipe.仲添_麹米 || 0) + 
                             (recipe.留添_麹米 || 0)}
                          </td>
                        </tr>

                        {/* 汲み水 */}
                        <tr>
                          <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50">汲み水</td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.water}
                              onChange={(e) => handleCellEdit('water', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.初添_汲み水 ?? ''}
                              onChange={(e) => handleCellEdit('初添_汲み水', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.仲添_汲み水 ?? ''}
                              onChange={(e) => handleCellEdit('仲添_汲み水', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={recipe.留添_汲み水 ?? ''}
                              onChange={(e) => handleCellEdit('留添_汲み水', e.target.value)}
                              className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-center font-bold bg-slate-100">
                            {(recipe.water || 0) + 
                             (recipe.初添_汲み水 || 0) + 
                             (recipe.仲添_汲み水 || 0) + 
                             (recipe.留添_汲み水 || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-4 text-sm text-slate-700">
                      <p><strong>留までの汲水歩合:</strong> {recipe.留までの汲水歩合 ?? '-'}</p>
                    </div>
                  </div>
                );
              })()}
<p className="text-xs text-slate-500 mt-3">
                ※各セルをクリックして編集可能。「変更を保存」ボタンで保存されます。
              </p>
              
              {/* ========== ここに追加 ========== */}
              {hasUnsavedChanges && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleSaveChanges}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg transition-all"
                  >
                    💾 変更を保存
                  </button>
                </div>
              )}
              {/* ========== ここまで ========== */}
              
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}