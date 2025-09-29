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
    isLoading: boolean;
    loadError: string | null;
  };
}

export default function TankAssignment({ dataContext }: TankAssignmentProps) {
  const [assignments, setAssignments] = useState<Map<number, { shuboType: string; tankId: string }>>(new Map());

  const enabledTanks = dataContext.getEnabledTanks();
  const dualShuboFlags = checkDualShubo(dataContext.shuboRawData);

  function canSelectTank(tankId: string, shuboNumber: number): boolean {
    const currentAssignment = assignments.get(shuboNumber);
    if (currentAssignment?.tankId === tankId) return true;
    
    const currentShubo = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    if (!currentShubo) return true;
    
    const currentStartDate = convertExcelDateToJs(parseFloat(currentShubo.shuboStartDate));
    const currentEndDate = convertExcelDateToJs(parseFloat(currentShubo.shuboEndDate));
    
    const otherUsage = Array.from(assignments.entries()).filter(([num, assignment]) => 
      num !== shuboNumber && assignment.tankId === tankId
    );
    
    for (const [otherNum, _] of otherUsage) {
      const otherShubo = dataContext.shuboRawData.find(s => s.shuboNumber === otherNum);
      if (!otherShubo) continue;
      
      const otherStartDate = convertExcelDateToJs(parseFloat(otherShubo.shuboStartDate));
      const otherEndDate = convertExcelDateToJs(parseFloat(otherShubo.shuboEndDate));
      
      const hasOverlap = currentStartDate <= otherEndDate && currentEndDate >= otherStartDate;
      if (hasOverlap) return false;
    }
    
    const configuredUsage = dataContext.configuredShuboData.filter(config => 
      config.selectedTankId === tankId && config.shuboNumber !== shuboNumber
    );
    
    for (const config of configuredUsage) {
      const hasOverlap = currentStartDate <= config.shuboEndDate && currentEndDate >= config.shuboStartDate;
      if (hasOverlap) return false;
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
        return config.shuboEndDate > latest ? config.shuboEndDate : latest;
      }, configuredUsage[0].shuboEndDate);
      
      return formatShortDate(new Date(latestEndDate.getTime() + 24 * 60 * 60 * 1000));
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
    
    const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
    const isDualPrimary = dualShuboFlags[shuboIndex];
    const isDualSecondary = shuboIndex > 0 && dualShuboFlags[shuboIndex - 1];
    const isDual = isDualPrimary || isDualSecondary;
    
    const waterAmount = isDual ? recipe.water / 2 : recipe.water;
    const lacticAmount = isDual ? recipe.lacticAcid / 2 : recipe.lacticAcid;

    return {
      water: waterAmount,
      lacticAcid: lacticAmount,
      totalRice: isDual ? recipe.recipeTotalRice / 2 : recipe.recipeTotalRice
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

  function handleSaveAll() {
    console.log('設定を保存:', Array.from(assignments.entries()));
    alert('保存機能は未実装です');
  }

  const displayShuboData = dataContext.shuboRawData.map((shubo, index) => {
    const isDualPrimary = dualShuboFlags[index];
    const isDualSecondary = index > 0 && dualShuboFlags[index - 1];
    
    const actualPrimary = isDualPrimary;
    const actualSecondary = !isDualPrimary && isDualSecondary && dualShuboFlags[index];
    
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">タンク割り当て</h2>
              <p className="text-slate-600">各酒母の酛種類とタンクを選択してください</p>
            </div>
            <div className="hidden md:flex space-x-4">
              <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl">
                <span className="text-blue-700 font-semibold">酒母</span>
                <span className="text-blue-900 ml-2 font-bold text-lg">{dataContext.shuboRawData.length}件</span>
              </div>
              <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-xl">
                <span className="text-green-700 font-semibold">タンク</span>
                <span className="text-green-900 ml-2 font-bold text-lg">{enabledTanks.length}個</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h3 className="text-xl font-bold text-white">酒母スケジュール</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
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
                      shubo.isDualPrimary || shubo.isDualSecondary ? 'bg-amber-50' : index % 2 === 0 ? 'bg-slate-25' : 'bg-white'
                    }`}>
                      <td className="px-3 py-2 border-r">
                        <span className="font-bold text-slate-800">{shubo.shuboNumber}号</span>
                      </td>
                      <td className="px-3 py-2 border-r">
                        <span className="font-semibold text-slate-700">{shubo.brewingScale}kg</span>
                      </td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.brewingCategory}</td>
                      <td className="px-3 py-2 border-r font-mono text-xs">
                        {formatShortDate(convertExcelDateToJs(parseFloat(shubo.shuboStartDate)))}
                      </td>
                      <td className="px-3 py-2 border-r font-mono text-xs">
                        {formatShortDate(convertExcelDateToJs(parseFloat(shubo.shuboEndDate)))}
                      </td>
                      <td className="px-3 py-2 border-r">{shubo.shuboDays}日</td>
                      <td className="px-3 py-2 border-r text-xs">{shubo.yeast}</td>
                      <td className="px-3 py-2 border-r">{shubo.shuboTotalRice}kg</td>
                      <td className="px-3 py-2 border-r">
                        <select
                          value={assignment.shuboType}
                          onChange={(e) => handleShuboTypeChange(shubo.shuboNumber, e.target.value)}
                          className="w-full px-2 py-1 border-2 border-slate-400 bg-white rounded text-slate-900 text-xs"
                        >
                          <option value="速醸">速醸</option>
                          <option value="高温糖化">高温糖化</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 border-r">
                        <select
                          value={assignment.tankId}
                          onChange={(e) => handleTankChange(shubo.shuboNumber, e.target.value)}
                          disabled={shubo.isDualSecondary}
                          className="w-full px-2 py-1 border-2 border-slate-400 bg-white rounded text-slate-900 text-xs disabled:bg-slate-100"
                        >
                          <option value="">選択</option>
                          {enabledTanks.map(tank => {
                            const isAvailable = canSelectTank(tank.tankId, shubo.shuboNumber);
                            return (
                              <option key={tank.tankId} value={tank.tankId} disabled={!isAvailable}>
                                {tank.tankId} ({tank.maxCapacity}L)
                              </option>
                            );
                          })}
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
          
          <div className="bg-slate-50 px-6 py-4 border-t">
            <button
              onClick={handleSaveAll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl"
            >
              一括保存
            </button>
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
                  const assignmentEntry = Array.from(assignments.entries()).find(([num, assignment]) => assignment.tankId === tank.tankId);
                  const configuredEntry = dataContext.configuredShuboData.find(config => config.selectedTankId === tank.tankId);
                  
                  const isUsed = assignmentEntry || configuredEntry;
                  const usedBy = assignmentEntry ? `${assignmentEntry[0]}号` : configuredEntry ? `${configuredEntry.shuboNumber}号` : '';
                  const availableDate = getTankAvailableDate(tank.tankId);
                  
                  return (
                    <tr key={tank.tankId} className={`hover:bg-slate-50 border-b ${index % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}>
                      <td className="px-4 py-2 font-bold">{tank.tankId}</td>
                      <td className="px-4 py-2">{tank.maxCapacity}L</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                          isUsed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {isUsed ? '使用中' : '空き'}
                        </span>
                      </td>
                      <td className="px-4 py-2">{usedBy || '-'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{availableDate}</td>
                      <td className="px-4 py-2">
                        {tank.isRecommended && (
                          <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">推奨</span>
                        )}
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