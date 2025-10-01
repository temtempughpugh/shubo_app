import { useState, useEffect } from 'react';
import { STORAGE_KEYS, DEFAULT_ANALYSIS_SETTINGS, type AnalysisSettings } from '../utils/types';

interface AnalysisSettingsProps {
  onClose: () => void;
}

export default function AnalysisSettings({ onClose }: AnalysisSettingsProps) {
  const [settings, setSettings] = useState<AnalysisSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ANALYSIS_SETTINGS);
    return saved ? JSON.parse(saved) : DEFAULT_ANALYSIS_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ANALYSIS_SETTINGS, JSON.stringify(settings));
  }, [settings]);

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

          </div>
        </div>

      </div>
    </div>
  );
}