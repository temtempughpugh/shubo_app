import React, { useState } from 'react';
import type { 
  ShuboRawData, 
  ConfiguredShuboData,
  TankConfigData 
} from '../utils/types';
import { 
  findRecipe, 
  convertCapacityToKensyaku,
  convertExcelDateToJs,
  checkDualShubo,
  formatDualValue,
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
  // 酛種類・タンク選択の状態
  const [assignments, setAssignments] = useState<Map<number, { shuboType: string; tankId: string }>>(new Map());

  const enabledTanks = dataContext.getEnabledTanks();
  const dualShuboFlags = checkDualShubo(dataContext.shuboRawData);

  console.log('タンク割り当て画面:', {
    酒母データ: dataContext.shuboRawData.length,
    有効タンク: enabledTanks.length
  });

  // タンク選択可否判定（シンプル版）
  function canSelectTank(tankId: string, shuboNumber: number): boolean {
    // 1. 自分が選択中かチェック
    const currentAssignment = assignments.get(shuboNumber);
    if (currentAssignment?.tankId === tankId) {
      return true;
    }
    
    // 2. 現在の酒母の日程を取得
    const currentShubo = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    if (!currentShubo) return true;
    
    const currentStartDate = convertExcelDateToJs(parseFloat(currentShubo.shuboStartDate));
    const currentEndDate = convertExcelDateToJs(parseFloat(currentShubo.shuboEndDate));
    
    // 3. 他の酒母の選択と日程比較
    const otherUsage = Array.from(assignments.entries()).filter(([num, assignment]) => 
      num !== shuboNumber && assignment.tankId === tankId
    );
    
    for (const [otherNum, _] of otherUsage) {
      const otherShubo = dataContext.shuboRawData.find(s => s.shuboNumber === otherNum);
      if (!otherShubo) continue;
      
      const otherStartDate = convertExcelDateToJs(parseFloat(otherShubo.shuboStartDate));
      const otherEndDate = convertExcelDateToJs(parseFloat(otherShubo.shuboEndDate));
      
      // 期間重複チェック
      const hasOverlap = currentStartDate <= otherEndDate && currentEndDate >= otherStartDate;
      if (hasOverlap) return false;
    }
    
    // 4. 設定済みデータとの重複チェック
    const configuredUsage = dataContext.configuredShuboData.filter(config => 
      config.selectedTankId === tankId && config.shuboNumber !== shuboNumber
    );
    
    for (const config of configuredUsage) {
      const hasOverlap = currentStartDate <= config.shuboEndDate && currentEndDate >= config.shuboStartDate;
      if (hasOverlap) return false;
    }
    
    return true;
  }

  // 酛種類変更（乳酸・汲み水も計算）
  function handleShuboTypeChange(shuboNumber: number, shuboType: string) {
    setAssignments(current => {
      const newMap = new Map(current);
      const existing = newMap.get(shuboNumber) || { shuboType: '速醸', tankId: '' };
      newMap.set(shuboNumber, { ...existing, shuboType });
      return newMap;
    });
  }

  // タンク選択変更
  function handleTankChange(shuboNumber: number, tankId: string) {
    setAssignments(current => {
      const newMap = new Map(current);
      const existing = newMap.get(shuboNumber) || { shuboType: '速醸', tankId: '' };
      newMap.set(shuboNumber, { ...existing, tankId });

      // 2個酛の場合は連動設定
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

  // タンク使用可能日を計算
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
        return formatShortDate(new Date(endDate.getTime() + 24 * 60 * 60 * 1000)); // 翌日
      }
    }
    
    if (configuredUsage.length > 0) {
      const latestEndDate = configuredUsage.reduce((latest, config) => {
        return config.shuboEndDate > latest ? config.shuboEndDate : latest;
      }, configuredUsage[0].shuboEndDate);
      
      return formatShortDate(new Date(latestEndDate.getTime() + 24 * 60 * 60 * 1000)); // 翌日
    }
    
    return 'すぐ使用可';
  }

  // 配合情報計算（2個酛は個別の値）
  function getRecipeData(shuboNumber: number) {
    const shuboData = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    const assignment = assignments.get(shuboNumber);
    const shuboType = assignment?.shuboType || '速醸';
    
    if (!shuboData) return null;
    
    const recipe = findRecipe(dataContext.recipeRawData, shuboType, shuboData.brewingScale);
    
    if (!recipe) return null;
    
    // 2個酛判定
    const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
    const isDualPrimary = dualShuboFlags[shuboIndex];
    const isDualSecondary = shuboIndex > 0 && dualShuboFlags[shuboIndex - 1];
    const isDual = isDualPrimary || isDualSecondary;
    
    // 2個酛の場合は半分の値
    const waterAmount = isDual ? recipe.water / 2 : recipe.water;
    const lacticAmount = isDual ? recipe.lacticAcid / 2 : recipe.lacticAcid;

    return {
      water: waterAmount,
      lacticAcid: lacticAmount,
      totalRice: isDual ? recipe.recipeTotalRice / 2 : recipe.recipeTotalRice
    };
  }

  // 検尺計算（一時的に無効化）
  function getKensyaku(shuboNumber: number): string {
    return '-'; // 一時的に無効化
  }

  // 一括保存
  function handleSaveAll() {
    const configuredData: ConfiguredShuboData[] = [];
    
    assignments.forEach((assignment, shuboNumber) => {
      if (assignment.shuboType && assignment.tankId) {
        const shuboData = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
        const recipeData = getRecipeData(shuboNumber);
        
        if (shuboData && recipeData) {
          configuredData.push({
            shuboNumber,
            displayName: `${shuboNumber}号`,
            selectedTankId: assignment.tankId,
            shuboType: assignment.shuboType,
            shuboStartDate: convertExcelDateToJs(parseFloat(shuboData.shuboStartDate)),
            shuboEndDate: convertExcelDateToJs(parseFloat(shuboData.shuboEndDate)),
            shuboDays: shuboData.shuboDays,
            recipeData: {
              totalRice: recipeData.totalRice,
              steamedRice: 0,
              kojiRice: 0,
              water: recipeData.water,
              measurement: 0,
              lacticAcid: recipeData.lacticAcid
            },
            tankData: {
              tankDisplayName: assignment.tankId,
              maxCapacity: 0,
              waterKensyaku: 0,
              waterCapacity: recipeData.water
            },
            dualShuboInfo: {
              isDualShubo: false,
              primaryNumber: shuboNumber,
              combinedDisplayName: `${shuboNumber}号`
            },
            originalData: shuboData
          });
        }
      }
    });
    
    // 保存処理は後で実装
    console.log('設定データ:', configuredData);
    alert(`${configuredData.length}件の設定を準備しました（保存機能は未実装）`);
  }

  // 酒母データの表示用整形（最終修正版）
  const displayShuboData = dataContext.shuboRawData.map((shubo, index) => {
    const isDualPrimary = dualShuboFlags[index];
    const isDualSecondary = index > 0 && dualShuboFlags[index - 1];
    
    // 排他制御：Primaryが優先、Secondaryは非Primaryの場合のみ
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

    console.log(`表示データ生成 ${shubo.shuboNumber}号: dualLabel="${dualLabel}"`);

    return {
      ...shubo,
      isDualPrimary: actualPrimary,
      isDualSecondary: actualSecondary,
      dualLabel: dualLabel
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 p-8 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-slate-800 mb-3">タンク割り当て</h2>
            <p className="text-slate-600 text-lg">各酒母の酛種類とタンクを選択してください。2個酛は自動で統合表示されます。</p>
          </div>
          <div className="hidden md:flex space-x-4">
            <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl">
              <span className="text-blue-700 font-semibold">酒母データ</span>
              <span className="text-blue-900 ml-2 font-bold text-lg">{dataContext.shuboRawData.length}件</span>
            </div>
            <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-xl">
              <span className="text-green-700 font-semibold">有効タンク</span>
              <span className="text-green-900 ml-2 font-bold text-lg">{enabledTanks.length}個</span>
            </div>
          </div>
        </div>
      </div>

      {/* 酒母スケジュール・設定 */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
          <h3 className="text-2xl font-bold text-white">酒母スケジュール・設定</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">順号</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">仕込規模</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">仕込区分</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">仕込日</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">卸日</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">日順</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">酵母</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">モト総米</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">酛種類</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">タンク</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">汲み水</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">検尺</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-r border-slate-200">乳酸</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">2個酛</th>
              </tr>
            </thead>
            <tbody>
              {displayShuboData.map((shubo, index) => {
                const assignment = assignments.get(shubo.shuboNumber) || { shuboType: '速醸', tankId: '' };
                const recipeData = getRecipeData(shubo.shuboNumber);
                const kensyaku = getKensyaku(shubo.shuboNumber);
                
                return (
                  <tr key={shubo.shuboNumber} className={`
                    hover:bg-blue-50 transition-colors duration-200 border-b border-slate-100
                    ${shubo.isDualPrimary || shubo.isDualSecondary ? 'bg-amber-50 hover:bg-amber-100' : ''}
                    ${index % 2 === 0 ? 'bg-slate-25' : 'bg-white'}
                  `}>
                    {/* 順号 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <div className="flex items-center">
                        <span className="font-bold text-slate-800 text-lg">{shubo.shuboNumber}</span>
                        <span className="text-slate-600 text-sm ml-1">号</span>
                      </div>
                    </td>
                    
                    {/* 仕込規模 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="font-semibold text-slate-700">{shubo.brewingScale}</span>
                      <span className="text-slate-500 text-sm ml-1">kg</span>
                    </td>
                    
                    {/* 仕込区分 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                        {shubo.brewingCategory}
                      </span>
                    </td>
                    
                    {/* 仕込日 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="font-mono text-slate-700 font-semibold">
                        {formatShortDate(convertExcelDateToJs(parseFloat(shubo.shuboStartDate)))}
                      </span>
                    </td>
                    
                    {/* 卸日 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="font-mono text-slate-700 font-semibold">
                        {formatShortDate(convertExcelDateToJs(parseFloat(shubo.shuboEndDate)))}
                      </span>
                    </td>
                    
                    {/* 日順 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="font-semibold text-slate-700">{shubo.shuboDays}</span>
                      <span className="text-slate-500 text-sm ml-1">日</span>
                    </td>
                    
                    {/* 酵母 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="text-slate-700 font-medium">{shubo.yeast}</span>
                    </td>
                    
                    {/* モト総米 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="font-semibold text-slate-700">{shubo.shuboTotalRice}</span>
                      <span className="text-slate-500 text-sm ml-1">kg</span>
                    </td>
                    
                    {/* 酛種類 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <select
                        value={assignment.shuboType}
                        onChange={(e) => handleShuboTypeChange(shubo.shuboNumber, e.target.value)}
                        className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white shadow-sm hover:border-slate-300"
                      >
                        <option value="速醸">速醸</option>
                        <option value="高温糖化">高温糖化</option>
                      </select>
                    </td>
                    
                    {/* タンク選択 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <select
                        value={assignment.tankId}
                        onChange={(e) => handleTankChange(shubo.shuboNumber, e.target.value)}
                        disabled={shubo.isDualSecondary}
                        className={`w-full px-4 py-2 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm ${
                          shubo.isDualSecondary 
                            ? 'bg-slate-100 border-slate-200 text-slate-500' 
                            : 'bg-white border-slate-200 hover:border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      >
                        <option value="">タンク選択</option>
                        {enabledTanks.map(tank => {
                          const isAvailable = canSelectTank(tank.tankId, shubo.shuboNumber);
                          
                          return (
                            <option 
                              key={tank.tankId} 
                              value={tank.tankId}
                              disabled={!isAvailable}
                            >
                              {tank.tankId} ({tank.maxCapacity}L) {!isAvailable ? ' (使用不可)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    
                    {/* 汲み水 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <div className="flex items-center">
                        <span className={`font-semibold ${recipeData ? 'text-blue-700' : 'text-slate-400'}`}>
                          {recipeData ? recipeData.water : '-'}
                        </span>
                        {recipeData && <span className="text-slate-500 text-sm ml-1">L</span>}
                      </div>
                    </td>
                    
                    {/* 検尺 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <span className="text-slate-700 font-medium">{kensyaku}</span>
                    </td>
                    
                    {/* 乳酸 */}
                    <td className="px-6 py-4 border-r border-slate-100">
                      <div className="flex items-center">
                        <span className={`font-semibold ${recipeData ? 'text-green-700' : 'text-slate-400'}`}>
                          {recipeData ? recipeData.lacticAcid : '-'}
                        </span>
                        {recipeData && <span className="text-slate-500 text-sm ml-1">ml</span>}
                      </div>
                    </td>
                    
                    {/* 2個酛 */}
                    <td className="px-6 py-4">
                      {shubo.dualLabel ? (
                        <span className="inline-block bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                          {shubo.dualLabel}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* 一括保存ボタン */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-8 py-6 border-t border-slate-200">
          <button
            onClick={handleSaveAll}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            設定を一括保存
          </button>
        </div>
      </div>

      {/* タンク使用状況テーブル */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
          <h3 className="text-2xl font-bold text-white">タンク使用状況</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">タンクID</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">容量</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">状況</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">使用者</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">使用可能日</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">備考</th>
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
                  <tr key={tank.tankId} className={`
                    hover:bg-slate-50 transition-colors duration-200 border-b border-slate-100
                    ${index % 2 === 0 ? 'bg-white' : 'bg-slate-25'}
                  `}>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-800 text-lg">{tank.tankId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="font-semibold text-slate-700">{tank.maxCapacity}</span>
                        <span className="text-slate-500 text-sm ml-1">L</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                        isUsed 
                          ? 'bg-red-100 border border-red-200 text-red-800' 
                          : 'bg-green-100 border border-green-200 text-green-800'
                      }`}>
                        {isUsed ? '使用中' : '空き'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {usedBy ? (
                        <span className="font-semibold text-slate-700">{usedBy}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-700 font-semibold">{availableDate}</span>
                    </td>
                    <td className="px-6 py-4">
                      {tank.isRecommended && (
                        <span className="inline-block bg-blue-100 border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          推奨タンク
                        </span>
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
  );
}