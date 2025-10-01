import React, { useState } from 'react';
import type { 
  ShuboRawData, 
  ConfiguredShuboData,
  TankConfigData 
} from '../utils/types';
import { 
  findRecipe, 
  convertExcelDateToJs,
  checkDualShubo,
  formatShortDate
} from '../utils/dataUtils';

interface TankAssignmentProps {
  dataContext: {
    shuboRawData: ShuboRawData[];
    recipeRawData: any[];
    tankConversionMap: Map<string, any[]>;
    configuredShuboData: ConfiguredShuboData[];
    getEnabledTanks: () => TankConfigData[];
    saveConfiguredShubo: (data: ConfiguredShuboData) => void;
    isLoading: boolean;
    loadError: string | null;
  };
  onTankSettings: () => void;
}

export default function TankAssignment({ dataContext, onTankSettings }: TankAssignmentProps) {
  const [assignments, setAssignments] = useState<Map<number, { shuboType: string; tankId: string }>>(new Map());

  const enabledTanks = dataContext.getEnabledTanks().sort((a, b) => a.maxCapacity - b.maxCapacity);
  const dualShuboFlags = checkDualShubo(dataContext.shuboRawData);

  React.useEffect(() => {
    const initialMap = new Map<number, { shuboType: string; tankId: string }>();
    dataContext.configuredShuboData.forEach(config => {
      initialMap.set(config.shuboNumber, {
        shuboType: config.shuboType,
        tankId: config.selectedTankId
      });
    });
    setAssignments(initialMap);
  }, []);

  function canSelectTank(tankId: string, shuboNumber: number): boolean {
    const currentAssignment = assignments.get(shuboNumber);
    if (currentAssignment?.tankId === tankId) return true;

    const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
    const isDualSecondary = shuboIndex > 0 && dualShuboFlags[shuboIndex - 1] && dualShuboFlags[shuboIndex];

    if (isDualSecondary) {
      const prevShubo = dataContext.shuboRawData[shuboIndex - 1];
      const prevAssignment = assignments.get(prevShubo.shuboNumber);
      return prevAssignment?.tankId === tankId;
    }

    // 他の酒母が使用中かチェック（期間の重複を考慮）
    const currentShubo = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    if (!currentShubo) return true;
    
    const currentStartDate = convertExcelDateToJs(parseFloat(currentShubo.shuboStartDate));
    const currentEndDate = convertExcelDateToJs(parseFloat(currentShubo.shuboEndDate));

    for (const [num, assignment] of assignments.entries()) {
      if (num === shuboNumber || assignment.tankId !== tankId) continue;
      
      const otherShubo = dataContext.shuboRawData.find(s => s.shuboNumber === num);
      if (!otherShubo) continue;
      
      const otherStartDate = convertExcelDateToJs(parseFloat(otherShubo.shuboStartDate));
      const otherEndDate = convertExcelDateToJs(parseFloat(otherShubo.shuboEndDate));
      
      // 期間が重複しているかチェック
      const isOverlapping = !(currentEndDate < otherStartDate || currentStartDate > otherEndDate);
      
      if (isOverlapping) {
        return false;
      }
    }

    return true;
  }

  function handleShuboTypeChange(shuboNumber: number, shuboType: string) {
    setAssignments(current => {
      const newMap = new Map(current);
      const existing = newMap.get(shuboNumber) || { shuboType: '速醸', tankId: '' };
      newMap.set(shuboNumber, { ...existing, shuboType });
      return newMap;
    });

    const assignment = assignments.get(shuboNumber);
    const tankId = assignment?.tankId || '';
    if (tankId) {
      const configData = createConfiguredShuboData(shuboNumber, shuboType, tankId);
      if (configData) {
        dataContext.saveConfiguredShubo(configData);
      }
    }
  }

  function handleTankChange(shuboNumber: number, tankId: string) {
    setAssignments(current => {
      const newMap = new Map(current);
      const existing = newMap.get(shuboNumber) || { shuboType: '速醸', tankId: '' };
      newMap.set(shuboNumber, { ...existing, tankId });

      const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
      const isDualPrimary = dualShuboFlags[shuboIndex];
      
      if (isDualPrimary && shuboIndex < dataContext.shuboRawData.length - 1) {
        const nextShubo = dataContext.shuboRawData[shuboIndex + 1];
        const nextExisting = newMap.get(nextShubo.shuboNumber) || { shuboType: '速醸', tankId: '' };
        newMap.set(nextShubo.shuboNumber, { ...nextExisting, tankId });
      }

      return newMap;
    });

    const assignment = assignments.get(shuboNumber);
    const shuboType = assignment?.shuboType || '速醸';
    
    if (tankId) {
      const configData = createConfiguredShuboData(shuboNumber, shuboType, tankId);
      if (configData) {
        dataContext.saveConfiguredShubo(configData);
      }

      const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
      const isDualPrimary = dualShuboFlags[shuboIndex];

      if (isDualPrimary && shuboIndex < dataContext.shuboRawData.length - 1) {
        const nextShubo = dataContext.shuboRawData[shuboIndex + 1];
        const nextAssignment = assignments.get(nextShubo.shuboNumber);
        const nextShuboType = nextAssignment?.shuboType || '速醸';
        
        const nextConfigData = createConfiguredShuboData(nextShubo.shuboNumber, nextShuboType, tankId);
        if (nextConfigData) {
          dataContext.saveConfiguredShubo(nextConfigData);
        }
      }
    }
  }

  function createConfiguredShuboData(
    shuboNumber: number,
    shuboType: string,
    tankId: string
  ): ConfiguredShuboData | null {
    const shuboData = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    if (!shuboData) return null;

    const recipe = findRecipe(dataContext.recipeRawData, shuboType, shuboData.brewingScale);
    if (!recipe) return null;

    const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
    const isDualPrimary = dualShuboFlags[shuboIndex];
    const isDualSecondary = shuboIndex > 0 && dualShuboFlags[shuboIndex - 1];
    const isDual = isDualPrimary || isDualSecondary;

    const shuboStartDate = convertExcelDateToJs(parseFloat(shuboData.shuboStartDate));
    const shuboEndDate = convertExcelDateToJs(parseFloat(shuboData.shuboEndDate));

    const tankData = enabledTanks.find(t => t.tankId === tankId);
    const tankConversions = dataContext.tankConversionMap.get(tankId) || [];
    
    // 修正: 2個酛でもレシピをそのまま使用
    const waterAmount = recipe.water;
    const waterConversion = tankConversions.find(c => c.capacity >= waterAmount) || tankConversions[0];

    let displayName = `${shuboNumber}号`;
    let primaryNumber = shuboNumber;
    let secondaryNumber: number | undefined;
    let combinedDisplayName = displayName;

    if (isDualPrimary) {
      const nextShubo = dataContext.shuboRawData[shuboIndex + 1];
      displayName = `${shuboNumber}・${nextShubo.shuboNumber}号`;
      secondaryNumber = nextShubo.shuboNumber;
      combinedDisplayName = displayName;
    } else if (isDualSecondary) {
      const prevShubo = dataContext.shuboRawData[shuboIndex - 1];
      displayName = `${prevShubo.shuboNumber}・${shuboNumber}号`;
      primaryNumber = prevShubo.shuboNumber;
      secondaryNumber = shuboNumber;
      combinedDisplayName = displayName;
    }

    const calculatedDays = Math.floor((shuboEndDate.getTime() - shuboStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      shuboNumber,
      displayName,
      selectedTankId: tankId,
      shuboType,
      shuboStartDate,
      shuboEndDate,
      shuboDays: calculatedDays,
      recipeData: {
        // 修正: すべてそのまま保存（半分にしない）
        totalRice: recipe.recipeTotalRice,
        steamedRice: recipe.steamedRice,
        kojiRice: recipe.kojiRice,
        water: recipe.water,
        measurement: recipe.measurement,
        lacticAcid: recipe.lacticAcid,
      },
      tankData: {
        tankDisplayName: tankData?.displayName || tankId,
        maxCapacity: tankData?.maxCapacity || 0,
        waterKensyaku: waterConversion?.kensyaku || 0,
        waterCapacity: waterConversion?.capacity || 0,
      },
      dualShuboInfo: {
        isDualShubo: isDual,
        isPrimary: isDualPrimary,
        primaryNumber,
        secondaryNumber,
        combinedDisplayName,
      },
      originalData: shuboData,
    };
  }

  function getTankAvailableDate(tankId: string): string {
    const configuredUsage = dataContext.configuredShuboData.filter(config => 
      config.selectedTankId === tankId
    );
    
    const currentAssignment = Array.from(assignments.entries()).find(([_, assignment]) => 
      assignment.tankId === tankId
    );
    
    if (currentAssignment) {
      const shuboData = dataContext.shuboRawData.find(s => s.shuboNumber === currentAssignment[0]);
      if (shuboData) {
        const endDate = convertExcelDateToJs(parseFloat(shuboData.shuboEndDate));
        return formatShortDate(new Date(endDate.getTime() + 24 * 60 * 60 * 1000));
      }
    }
    
    if (configuredUsage.length > 0) {
      const latestEndDate = configuredUsage.reduce((latest, config) => {
        const configDate = new Date(config.shuboEndDate);
        const latestDate = new Date(latest);
        return configDate > latestDate ? config.shuboEndDate : latest;
      }, configuredUsage[0].shuboEndDate);
      
      return formatShortDate(new Date(new Date(latestEndDate).getTime() + 24 * 60 * 60 * 1000));
    }
    
    return 'すぐ使用可';
  }

  function getRecipeData(shuboNumber: number) {
    const shuboData = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    const assignment = assignments.get(shuboNumber);
    const shuboType = assignment?.shuboType || '速醸';
    
    if (!shuboData) return null;
    
    const recipe = findRecipe(dataContext.recipeRawData, shuboType, shuboData.brewingScale);
    
    if (!recipe) return null;

    // 修正: そのまま返す（半分にしない）
    return {
      water: recipe.water,
      lacticAcid: recipe.lacticAcid,
      totalRice: recipe.recipeTotalRice
    };
  }

  function getKensyaku(shuboNumber: number): string {
    const assignment = assignments.get(shuboNumber);
    const recipeData = getRecipeData(shuboNumber);
    
    if (!assignment?.tankId || !recipeData) return '-';
    
    try {
      const tankConversions = dataContext.tankConversionMap.get(assignment.tankId);
      if (!tankConversions) return '-';
      
      const targetCapacity = recipeData.water;
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
      
      return `${closestConversion.kensyaku}mm`;
    } catch {
      return '-';
    }
  }

  const displayShuboData = dataContext.shuboRawData.map((shubo, index) => {
    const isDualPrimary = dualShuboFlags[index];
    const isDualSecondary = index > 0 && dualShuboFlags[index - 1];
    
    // 修正: 正しい2個酛判定
    const actualPrimary = isDualPrimary && (!isDualSecondary);
    const actualSecondary = isDualPrimary && isDualSecondary;
    
    let dualLabel = '';
    if (actualPrimary) {
      const nextShubo = dataContext.shuboRawData[index + 1];
      if (nextShubo) {
        dualLabel = `${shubo.shuboNumber}・${nextShubo.shuboNumber}号 (1/2)`;
      }
    } else if (actualSecondary) {
      const prevShubo = dataContext.shuboRawData[index - 1];
      if (prevShubo) {
        dualLabel = `${prevShubo.shuboNumber}・${shubo.shuboNumber}号 (2/2)`;
      }
    }

    return {
      ...shubo,
      isDualPrimary: actualPrimary,
      isDualSecondary: actualSecondary,
      dualLabel: dualLabel
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">酒母スケジュール一覧</h2>
            <button
              onClick={onTankSettings}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold transition-all"
            >
              ⚙️ タンク設定
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">順号</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">仕込規模</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">仕込区分</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">仕込日</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">卸日</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">日順</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">酵母</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">モト総米</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r w-28">酛種類</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r w-48">タンク</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">汲水</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">検尺</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 border-r">乳酸</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 w-32">2個酛</th>
                </tr>
              </thead>
              <tbody>
                {displayShuboData.map((shubo, index) => {
                  const assignment = assignments.get(shubo.shuboNumber) || { shuboType: '速醸', tankId: '' };
                  const recipeData = getRecipeData(shubo.shuboNumber);
                  const kensyaku = getKensyaku(shubo.shuboNumber);
                  
                  return (
                    <tr key={shubo.shuboNumber} className={`hover:bg-blue-50 border-b ${
                      shubo.isDualPrimary || shubo.isDualSecondary ? 'bg-amber-50' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    }`}>
                      <td className="px-3 py-2 font-bold text-blue-700 border-r">{shubo.shuboNumber}号</td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.brewingScale}kg</td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.brewingCategory}</td>
                      <td className="px-3 py-2 border-r text-xs">
                        {shubo.shuboStartDate ? formatShortDate(convertExcelDateToJs(parseFloat(shubo.shuboStartDate))) : '-'}
                      </td>
                      <td className="px-3 py-2 border-r text-xs">
                        {shubo.shuboEndDate ? formatShortDate(convertExcelDateToJs(parseFloat(shubo.shuboEndDate))) : '-'}
                      </td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.shuboDays}日</td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.yeast}</td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.shuboTotalRice}kg</td>
                      <td className="px-3 py-2 border-r">
                        <select
                          value={assignment.shuboType}
                          onChange={(e) => handleShuboTypeChange(shubo.shuboNumber, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="速醸">速醸</option>
                          <option value="高温糖化">高温糖化</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 border-r">
                        <select
                          value={assignment.tankId}
                          onChange={(e) => handleTankChange(shubo.shuboNumber, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">選択</option>
                          {enabledTanks.map(tank => (
                            <option 
                              key={tank.tankId} 
                              value={tank.tankId}
                              disabled={!canSelectTank(tank.tankId, shubo.shuboNumber)}
                            >
                              {tank.displayName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 border-r">
                        <span className={recipeData ? 'text-blue-700 font-semibold' : 'text-slate-400'}>
                          {recipeData ? `${recipeData.water}L` : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-r text-xs">{kensyaku}</td>
                      <td className="px-3 py-2 border-r">
                        <span className={recipeData ? 'text-green-700 font-semibold' : 'text-slate-400'}>
                          {recipeData ? `${recipeData.lacticAcid}ml` : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {shubo.dualLabel ? (
                          <span className="inline-block bg-amber-100 border border-amber-300 text-amber-800 px-2 py-1 rounded-full text-xs">
                            {shubo.dualLabel}
                          </span>
                        ) : <span className="text-slate-400 text-xs">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-slate-800 px-6 py-4">
            <h3 className="text-xl font-bold text-white">タンク使用状況</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="px-4 py-3 text-left text-xs font-bold">タンクID</th>
                  <th className="px-4 py-3 text-left text-xs font-bold">容量</th>
                  <th className="px-4 py-3 text-left text-xs font-bold">状況</th>
                  <th className="px-4 py-3 text-left text-xs font-bold">使用者</th>
                  <th className="px-4 py-3 text-left text-xs font-bold">使用可能日</th>
                  <th className="px-4 py-3 text-left text-xs font-bold">備考</th>
                </tr>
              </thead>
              <tbody>
                {enabledTanks.map((tank, index) => {
                  const assignmentEntry = Array.from(assignments.entries()).find(([_, assignment]) => assignment.tankId === tank.tankId);
                  const configuredEntry = dataContext.configuredShuboData.find(config => config.selectedTankId === tank.tankId);
                  
                  const isUsed = assignmentEntry || configuredEntry;
                  const usedBy = assignmentEntry ? `${assignmentEntry[0]}号` : configuredEntry ? `${configuredEntry.shuboNumber}号` : '';
                  const availableDate = getTankAvailableDate(tank.tankId);
                  
                  return (
                    <tr key={tank.tankId} className={`hover:bg-slate-50 border-b ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-4 py-3 font-bold text-blue-700">{tank.tankId}</td>
                      <td className="px-4 py-3">{tank.maxCapacity}L</td>
                      <td className="px-4 py-3">
                        {isUsed ? (
                          <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                            使用中
                          </span>
                        ) : (
                          <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                            空き
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{usedBy || '-'}</td>
                      <td className="px-4 py-3">{availableDate}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">-</td>
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