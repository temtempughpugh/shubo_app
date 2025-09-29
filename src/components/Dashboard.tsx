import { useState, useMemo, useEffect } from 'react';
import type {
  ConfiguredShuboData,
  DailyRecordData,
  MergedShuboData
} from '../utils/types';
import { STORAGE_KEYS } from '../utils/types';

interface DashboardProps {
  dataContext: {
    shuboRawData: any[];
    recipeRawData: any[];
    tankConversionMap: Map<string, any[]>;
    configuredShuboData: ConfiguredShuboData[];
    mergedShuboData: MergedShuboData[];
    dailyRecordsData: DailyRecordData[];
    getDailyRecords: (shuboNumber: number) => DailyRecordData[];
    updateDailyRecord: (record: DailyRecordData) => void;
  };
}

interface DailyEnvironment {
  [dateKey: string]: {
    temperature: string;
    humidity: string;
  };
}

interface BrewingInput {
  [shuboNumber: number]: {
    iceAmount: number | null;
    mizukoujiTemperature: number | null;
    brewingTemperature: number | null;
    afterBrewingKensyaku: number | null;
  };
}

interface DischargeInput {
  [shuboNumber: number]: {
    beforeDischargeKensyaku: number | null;
    afterDischargeCapacity: number | null;
    destinationTank: string;
    dischargeWater: number | null;
  };
}

interface AnalysisInput {
  [shuboNumber: number]: {
    [dateKey: string]: {
      temperature: number | null;
      baume: number | null;
      acidity: number | null;
      temperatureAfterHeating: number | null;
      memo: string;
    };
  };
}

export default function Dashboard({ dataContext }: DashboardProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [dailyEnvironment, setDailyEnvironment] = useState<DailyEnvironment>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DAILY_ENVIRONMENT);
    return saved ? JSON.parse(saved) : {};
  });

  const [brewingInput, setBrewingInput] = useState<BrewingInput>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BREWING_PREPARATION);
    return saved ? JSON.parse(saved) : {};
  });

  const [dischargeInput, setDischargeInput] = useState<DischargeInput>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DISCHARGE_SCHEDULE);
    return saved ? JSON.parse(saved) : {};
  });

  const [analysisInput, setAnalysisInput] = useState<AnalysisInput>(() => {
    const saved = localStorage.getItem('shubo_analysis_input');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DAILY_ENVIRONMENT, JSON.stringify(dailyEnvironment));
  }, [dailyEnvironment]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BREWING_PREPARATION, JSON.stringify(brewingInput));
  }, [brewingInput]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DISCHARGE_SCHEDULE, JSON.stringify(dischargeInput));
  }, [dischargeInput]);

  useEffect(() => {
    localStorage.setItem('shubo_analysis_input', JSON.stringify(analysisInput));
  }, [analysisInput]);

  const getDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const currentDateKey = getDateKey(currentDate);
  const currentEnv = dailyEnvironment[currentDateKey] || { temperature: '', humidity: '' };

  const formatDate = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return `${year}/${month}/${day}(${dayOfWeek})`;
  };

  const calculateDayNumber = (startDate: Date | string, currentDate: Date): number => {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const diffTime = currentDate.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  };

  const getStatusForMerged = (shubo: MergedShuboData): string => {
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    
    const startDate = shubo.shuboStartDate instanceof Date 
      ? new Date(shubo.shuboStartDate) 
      : new Date(shubo.shuboStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    const lastEndDate = shubo.shuboEndDates[shubo.shuboEndDates.length - 1];
    const endDate = lastEndDate instanceof Date 
      ? new Date(lastEndDate) 
      : new Date(lastEndDate);
    endDate.setHours(0, 0, 0, 0);

    if (today < startDate) return '準備中';
    if (today >= startDate && today <= endDate) return '管理中';
    return '完了';
  };

  const getKensyakuFromCapacity = (tankId: string, targetCapacity: number): number | null => {
    const tankConversions = dataContext.tankConversionMap.get(tankId);
    if (!tankConversions || tankConversions.length === 0) return null;
    
    let closestConversion = tankConversions[0];
    let minDiff = Math.abs(tankConversions[0].capacity - targetCapacity);
    
    for (const conv of tankConversions) {
      const diff = Math.abs(conv.capacity - targetCapacity);
      if (diff < minDiff) {
        minDiff = diff;
        closestConversion = conv;
      }
      if (conv.capacity >= targetCapacity && closestConversion.capacity < targetCapacity) {
        break;
      }
    }
    
    return closestConversion.kensyaku;
  };

  const getCapacityFromKensyaku = (tankId: string, kensyaku: number): number | null => {
    const tankConversions = dataContext.tankConversionMap.get(tankId);
    if (!tankConversions) return null;
    
    const match = tankConversions.find(conv => conv.kensyaku === kensyaku);
    return match ? match.capacity : null;
  };

  const todayWorks = useMemo(() => {
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);

    const preparations = dataContext.mergedShuboData.filter(shubo => {
      const startDate = shubo.shuboStartDate instanceof Date 
        ? new Date(shubo.shuboStartDate) 
        : new Date(shubo.shuboStartDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === tomorrow.getTime();
    });

    const brewingSchedules = dataContext.mergedShuboData.filter(shubo => {
      const startDate = shubo.shuboStartDate instanceof Date 
        ? new Date(shubo.shuboStartDate) 
        : new Date(shubo.shuboStartDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === today.getTime();
    });

    const analysisSchedules = dataContext.mergedShuboData.filter(shubo => {
      const status = getStatusForMerged(shubo);
      if (status !== '管理中') return false;
      
      const dayNum = calculateDayNumber(shubo.shuboStartDate, currentDate);
      return dayNum > 1;
    });

    const dischargeSchedules = dataContext.mergedShuboData.filter(shubo => {
      return shubo.shuboEndDates.some(endDate => {
        const date = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === today.getTime();
      });
    });

    return {
      preparations,
      brewingSchedules,
      analysisSchedules,
      dischargeSchedules
    };
  }, [currentDate, dataContext.mergedShuboData]);

  const shuboList = useMemo(() => {
    type ShuboStatus = '管理中' | '準備中' | '完了';
    
    const list = dataContext.mergedShuboData.map(shubo => {
      const status = getStatusForMerged(shubo) as ShuboStatus;
      
      const startDate = shubo.shuboStartDate instanceof Date 
        ? shubo.shuboStartDate 
        : new Date(shubo.shuboStartDate);
      const lastEndDate = shubo.shuboEndDates[shubo.shuboEndDates.length - 1];
      const endDate = lastEndDate instanceof Date 
        ? lastEndDate 
        : new Date(lastEndDate);
      
      const diffTime = endDate.getTime() - startDate.getTime();
      const period = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        ...shubo,
        status,
        dayNumber: status === '管理中' 
          ? calculateDayNumber(shubo.shuboStartDate, currentDate)
          : null,
        period
      };
    });

    return list.sort((a, b) => {
      const statusOrder: Record<ShuboStatus, number> = { '管理中': 1, '準備中': 2, '完了': 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [dataContext.mergedShuboData, currentDate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-xl font-bold text-slate-800 hover:text-blue-600 cursor-pointer"
                >
                  📅 {formatDate(currentDate)}
                </button>
                {showDatePicker && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-xl p-2 z-50">
                    <input
                      type="date"
                      value={currentDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value + 'T00:00:00');
                        setCurrentDate(newDate);
                        setShowDatePicker(false);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-bold text-slate-600">気温</label>
                  <input
                    type="number"
                    value={currentEnv.temperature}
                    onChange={(e) => setDailyEnvironment({
                      ...dailyEnvironment,
                      [currentDateKey]: { ...currentEnv, temperature: e.target.value }
                    })}
                    placeholder="25"
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-slate-600">℃</span>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-bold text-slate-600">湿度</label>
                  <input
                    type="number"
                    value={currentEnv.humidity}
                    onChange={(e) => setDailyEnvironment({
                      ...dailyEnvironment,
                      [currentDateKey]: { ...currentEnv, humidity: e.target.value }
                    })}
                    placeholder="60"
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-slate-600">%</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const prev = new Date(currentDate);
                  prev.setDate(prev.getDate() - 1);
                  setCurrentDate(prev);
                }}
                className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg font-bold"
              >
                ← 前日
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
              >
                今日
              </button>
              <button
                onClick={() => {
                  const next = new Date(currentDate);
                  next.setDate(next.getDate() + 1);
                  setCurrentDate(next);
                }}
                className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg font-bold"
              >
                翌日 →
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-orange-600 px-4 py-2">
            <h3 className="text-base font-bold text-white">🔬 本日の作業 - 分析予定</h3>
          </div>
          <div className="p-4">
            {todayWorks.analysisSchedules.length === 0 ? (
              <p className="text-slate-500 text-center py-3 text-sm">分析対象の酒母はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="px-2 py-2 text-left text-xs font-bold">酒母名</th>
                      <th className="px-2 py-2 text-left text-xs font-bold">日数</th>
                      <th className="px-2 py-2 text-left text-xs font-bold">品温</th>
                      <th className="px-2 py-2 text-left text-xs font-bold">ボーメ</th>
                      <th className="px-2 py-2 text-left text-xs font-bold">酸度</th>
                      <th className="px-2 py-2 text-left text-xs font-bold">加温後品温</th>
                      <th className="px-2 py-2 text-left text-xs font-bold">メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayWorks.analysisSchedules.map(shubo => {
                      const dayNum = calculateDayNumber(shubo.shuboStartDate, currentDate);
                      const shuboAnalysis = analysisInput[shubo.primaryNumber] || {};
                      const currentAnalysis = shuboAnalysis[currentDateKey] || {
                        temperature: null,
                        baume: null,
                        acidity: null,
                        temperatureAfterHeating: null,
                        memo: ''
                      };

                      return (
                        <tr key={shubo.primaryNumber} className="border-b hover:bg-slate-50">
                          <td className="px-2 py-2 font-bold text-blue-700 text-xs">{shubo.displayName}</td>
                          <td className="px-2 py-2 text-xs">{dayNum}日目</td>
                          <td className="px-2 py-2">
                            <input 
                              type="number" 
                              step="0.1" 
                              value={currentAnalysis.temperature || ''} 
                              onChange={(e) => setAnalysisInput({
                                ...analysisInput,
                                [shubo.primaryNumber]: {
                                  ...shuboAnalysis,
                                  [currentDateKey]: {
                                    ...currentAnalysis,
                                    temperature: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                }
                              })}
                              placeholder="20.5" 
                              className="w-14 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input 
                              type="number" 
                              step="0.1" 
                              value={currentAnalysis.baume || ''} 
                              onChange={(e) => setAnalysisInput({
                                ...analysisInput,
                                [shubo.primaryNumber]: {
                                  ...shuboAnalysis,
                                  [currentDateKey]: {
                                    ...currentAnalysis,
                                    baume: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                }
                              })}
                              placeholder="10.5" 
                              className="w-14 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input 
                              type="number" 
                              step="0.1" 
                              value={currentAnalysis.acidity || ''} 
                              onChange={(e) => setAnalysisInput({
                                ...analysisInput,
                                [shubo.primaryNumber]: {
                                  ...shuboAnalysis,
                                  [currentDateKey]: {
                                    ...currentAnalysis,
                                    acidity: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                }
                              })}
                              placeholder="2.5" 
                              className="w-14 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input 
                              type="number" 
                              step="0.1" 
                              value={currentAnalysis.temperatureAfterHeating || ''} 
                              onChange={(e) => setAnalysisInput({
                                ...analysisInput,
                                [shubo.primaryNumber]: {
                                  ...shuboAnalysis,
                                  [currentDateKey]: {
                                    ...currentAnalysis,
                                    temperatureAfterHeating: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                }
                              })}
                              placeholder="22.0" 
                              className="w-14 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input 
                              type="text" 
                              value={currentAnalysis.memo || ''} 
                              onChange={(e) => setAnalysisInput({
                                ...analysisInput,
                                [shubo.primaryNumber]: {
                                  ...shuboAnalysis,
                                  [currentDateKey]: {
                                    ...currentAnalysis,
                                    memo: e.target.value
                                  }
                                }
                              })}
                              placeholder="順調" 
                              className="w-full px-2 py-1 text-xs border rounded" 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
            <div className="bg-purple-600 px-4 py-2">
              <h3 className="text-sm font-bold text-white">🧪 仕込み準備（明日）</h3>
            </div>
            <div className="p-4">
              {todayWorks.preparations.length === 0 ? (
                <p className="text-slate-500 text-center py-3 text-sm">仕込み準備なし</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="px-2 py-2 text-left text-xs font-bold">酒母</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">タンク</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">汲み水</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">氷量</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">準備水</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">尺</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">乳酸</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayWorks.preparations.map(shubo => {
                        const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
                        const waterAmount = shubo.recipeData.water;
                        const lacticAcidAmount = shubo.recipeData.lacticAcid;
                        
                        const waterDisplay = isDual 
                          ? `${waterAmount}L (${waterAmount/2}+${waterAmount/2})` 
                          : `${waterAmount}L`;
                        const lacticDisplay = isDual 
                          ? `${lacticAcidAmount}ml (${lacticAcidAmount/2}+${lacticAcidAmount/2})` 
                          : `${lacticAcidAmount}ml`;
                        
                        const input = brewingInput[shubo.primaryNumber] || { iceAmount: null };
                        const preparationWater = input.iceAmount ? waterAmount - input.iceAmount : waterAmount;
                        const kensyaku = getKensyakuFromCapacity(shubo.selectedTankId, preparationWater);

                        return (
                          <tr key={shubo.primaryNumber} className="border-b hover:bg-slate-50">
                            <td className="px-2 py-2 font-bold text-blue-700 text-xs">{shubo.displayName}</td>
                            <td className="px-2 py-2 text-xs">{shubo.selectedTankId}</td>
                            <td className="px-2 py-2 text-xs">{waterDisplay}</td>
                            <td className="px-2 py-2">
                              <input 
                                type="number" 
                                value={input.iceAmount || ''} 
                                onChange={(e) => setBrewingInput({
                                  ...brewingInput,
                                  [shubo.primaryNumber]: {
                                    ...input,
                                    iceAmount: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                })}
                                placeholder="0" 
                                className="w-14 px-1 py-1 text-xs border rounded" 
                              />
                            </td>
                            <td className="px-2 py-2 text-green-700 font-bold text-xs">
                              {input.iceAmount ? `${preparationWater}L` : '-'}
                            </td>
                            <td className="px-2 py-2 text-slate-700 text-xs">
                              {kensyaku !== null ? `${kensyaku}mm` : '-'}
                            </td>
                            <td className="px-2 py-2 text-xs">{lacticDisplay}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
            <div className="bg-green-600 px-4 py-2">
              <h3 className="text-sm font-bold text-white">🌾 仕込み予定（本日）</h3>
            </div>
            <div className="p-4">
              {todayWorks.brewingSchedules.length === 0 ? (
                <p className="text-slate-500 text-center py-3 text-sm">仕込み予定なし</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="px-2 py-2 text-left text-xs font-bold">酒母</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">タンク</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">水麹温度</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">仕込温度</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測予定</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測尺</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測歩合</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayWorks.brewingSchedules.map(shubo => {
                        const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
                        const expectedMeasurement = shubo.recipeData.measurement;
                        
                        const measurementDisplay = isDual 
                          ? `${expectedMeasurement}L (${expectedMeasurement/2}+${expectedMeasurement/2})` 
                          : `${expectedMeasurement}L`;
                        
                        const input = brewingInput[shubo.primaryNumber] || { 
                          mizukoujiTemperature: null, 
                          brewingTemperature: null, 
                          afterBrewingKensyaku: null 
                        };
                        const capacity = input.afterBrewingKensyaku 
                          ? getCapacityFromKensyaku(shubo.selectedTankId, input.afterBrewingKensyaku) 
                          : null;
                        const ratio = capacity && expectedMeasurement 
                          ? ((capacity / expectedMeasurement) * 100).toFixed(1) 
                          : null;

                        return (
                          <tr key={shubo.primaryNumber} className="border-b hover:bg-slate-50">
                            <td className="px-2 py-2 font-bold text-blue-700 text-xs">{shubo.displayName}</td>
                            <td className="px-2 py-2 text-xs">{shubo.selectedTankId}</td>
                            <td className="px-2 py-2">
                              <input 
                                type="number" 
                                value={input.mizukoujiTemperature || ''} 
                                onChange={(e) => setBrewingInput({
                                  ...brewingInput,
                                  [shubo.primaryNumber]: {
                                    ...input,
                                    mizukoujiTemperature: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                })}
                                placeholder="15" 
                                className="w-12 px-1 py-1 text-xs border rounded" 
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="number" 
                                value={input.brewingTemperature || ''} 
                                onChange={(e) => setBrewingInput({
                                  ...brewingInput,
                                  [shubo.primaryNumber]: {
                                    ...input,
                                    brewingTemperature: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                })}
                                placeholder="18" 
                                className="w-12 px-1 py-1 text-xs border rounded" 
                              />
                            </td>
                            <td className="px-2 py-2 text-xs">{measurementDisplay}</td>
                            <td className="px-2 py-2">
                              <input 
                                type="number" 
                                value={input.afterBrewingKensyaku || ''} 
                                onChange={(e) => setBrewingInput({
                                  ...brewingInput,
                                  [shubo.primaryNumber]: {
                                    ...input,
                                    afterBrewingKensyaku: e.target.value ? parseFloat(e.target.value) : null
                                  }
                                })}
                                placeholder="300" 
                                className="w-14 px-1 py-1 text-xs border rounded" 
                              />
                            </td>
                            <td className="px-2 py-2 text-green-700 font-bold text-xs">
                              {capacity ? `${capacity}L` : '-'}
                            </td>
                            <td className="px-2 py-2 text-blue-700 font-bold text-xs">
                              {ratio ? `${ratio}%` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-red-600 px-4 py-2">
            <h3 className="text-base font-bold text-white">📤 本日の作業 - 卸し予定</h3>
          </div>
          <div className="p-4">
            {todayWorks.dischargeSchedules.length === 0 ? (
              <p className="text-slate-500 text-center py-3 text-sm">本日の卸し予定はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="px-3 py-2 text-left text-xs font-bold">酒母名</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">タンク</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸前尺</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸前容量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸後容量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸後尺</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸し量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">添タンク</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">汲み水量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayWorks.dischargeSchedules.map(shubo => {
                      const input = dischargeInput[shubo.primaryNumber] || {
                        beforeDischargeKensyaku: null,
                        afterDischargeCapacity: null,
                        destinationTank: '',
                        dischargeWater: null
                      };
                      const beforeCapacity = input.beforeDischargeKensyaku 
                        ? getCapacityFromKensyaku(shubo.selectedTankId, input.beforeDischargeKensyaku) 
                        : null;
                      const afterCapacity = input.afterDischargeCapacity !== null ? input.afterDischargeCapacity : null;
                      const afterKensyaku = afterCapacity !== null && afterCapacity >= 0
                        ? getKensyakuFromCapacity(shubo.selectedTankId, afterCapacity)
                        : null;
                      const dischargeAmount = beforeCapacity !== null && afterCapacity !== null
                        ? beforeCapacity - afterCapacity 
                        : null;

                      return (
                        <tr key={shubo.primaryNumber} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-blue-700">{shubo.displayName}</td>
                          <td className="px-3 py-2">{shubo.selectedTankId}</td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={input.beforeDischargeKensyaku || ''} 
                              onChange={(e) => setDischargeInput({
                                ...dischargeInput,
                                [shubo.primaryNumber]: {
                                  ...input,
                                  beforeDischargeKensyaku: e.target.value ? parseFloat(e.target.value) : null
                                }
                              })}
                              placeholder="250" 
                              className="w-16 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                          <td className="px-3 py-2 text-green-700 font-bold">
                            {beforeCapacity ? `${beforeCapacity}L` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={input.afterDischargeCapacity !== null ? input.afterDischargeCapacity : ''} 
                              onChange={(e) => setDischargeInput({
                                ...dischargeInput,
                                [shubo.primaryNumber]: {
                                  ...input,
                                  afterDischargeCapacity: e.target.value !== '' ? parseFloat(e.target.value) : null
                                }
                              })}
                              placeholder="200" 
                              className="w-16 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {afterKensyaku !== null ? `${afterKensyaku}mm` : '-'}
                          </td>
                          <td className="px-3 py-2 text-blue-700 font-bold">
                            {dischargeAmount ? `${dischargeAmount}L` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={input.destinationTank} 
                              onChange={(e) => setDischargeInput({
                                ...dischargeInput,
                                [shubo.primaryNumber]: {
                                  ...input,
                                  destinationTank: e.target.value
                                }
                              })}
                              placeholder="" 
                              className="w-20 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={input.dischargeWater || ''} 
                              onChange={(e) => setDischargeInput({
                                ...dischargeInput,
                                [shubo.primaryNumber]: {
                                  ...input,
                                  dischargeWater: e.target.value ? parseFloat(e.target.value) : null
                                }
                              })}
                              placeholder="" 
                              className="w-16 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-slate-800 px-4 py-2">
            <h3 className="text-base font-bold text-white">📋 酒母一覧</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="px-3 py-2 text-left text-xs font-bold">酒母名</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">タンク</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">日数</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">仕込み日</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">卸日</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">期間</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">酵母</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {shuboList.map((shubo) => {
                  const statusColor = 
                    shubo.status === '管理中' ? 'bg-green-100 text-green-800' :
                    shubo.status === '準備中' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-slate-100 text-slate-600';

                  return (
                    <tr key={shubo.primaryNumber} className={`border-b hover:bg-slate-50 ${shubo.status === '管理中' ? 'bg-green-50' : ''}`}>
                      <td className="px-3 py-2 font-bold text-blue-700">{shubo.displayName}</td>
                      <td className="px-3 py-2">{shubo.selectedTankId}</td>
                      <td className="px-3 py-2">
                        {shubo.dayNumber ? `${shubo.dayNumber}日目` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const startDate = shubo.shuboStartDate instanceof Date 
                            ? shubo.shuboStartDate 
                            : new Date(shubo.shuboStartDate);
                          return startDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        {shubo.shuboEndDates.map((endDate, i) => {
                          const date = endDate instanceof Date ? endDate : new Date(endDate);
                          return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                        }).join(', ')}
                      </td>
                      <td className="px-3 py-2">{shubo.period}日</td>
                      <td className="px-3 py-2 text-xs">{shubo.originalData[0]?.yeast || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                          {shubo.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}