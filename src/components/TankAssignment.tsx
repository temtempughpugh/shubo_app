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
    getTankConversions: (tankId: string) => any[];
    saveConfiguredShubo: (data: ConfiguredShuboData) => void;
    removeConfiguredShubo: (shuboNumber: number) => void;
  };
}

export default function TankAssignment({ dataContext }: TankAssignmentProps) {
  const [assignments, setAssignments] = useState<Map<number, {shuboType: string, tankId: string}>>(new Map());

  const enabledTanks = dataContext.getEnabledTanks();
  const dualShuboFlags = checkDualShubo(dataContext.shuboRawData);

  console.log('タンク割り当て画面:', {
    酒母データ件数: dataContext.shuboRawData.length,
    有効タンク数: enabledTanks.length,
    二個酛フラグ: dualShuboFlags,
    選択中設定: Array.from(assignments.entries())
  });

  // 酒母データの表示用整形（最終修正版）
  const displayShuboData = dataContext.shuboRawData.map((shubo, index) => {
    const isDualPrimary = dualShuboFlags[index];
    const isDualSecondary = index > 0 && dualShuboFlags[index - 1];
    
    // 排他制御：Primaryが優先、Secondaryは自分がDualでPrimaryでない場合のみ
    const actualPrimary = isDualPrimary;
    const actualSecondary = !isDualPrimary && isDualSecondary && dualShuboFlags[index];
    
    const isDual = actualPrimary || actualSecondary;
    
    let dualLabel = '';
    if (actualPrimary && index + 1 < dataContext.shuboRawData.length) {
      // 2個酛の1番目
      const nextShubo = dataContext.shuboRawData[index + 1];
      dualLabel = `${shubo.shuboNumber}・${nextShubo?.shuboNumber}号 (1/2)`;
    } else if (actualSecondary) {
      // 2個酛の2番目
      const prevShubo = dataContext.shuboRawData[index - 1];
      dualLabel = `${prevShubo?.shuboNumber}・${shubo.shuboNumber}号 (2/2)`;
    }
    
    console.log(`表示データ生成 ${shubo.shuboNumber}号: primary=${actualPrimary}, secondary=${actualSecondary}, label="${dualLabel}"`);
    
    return {
      ...shubo,
      isDualShubo: isDual,
      isDualPrimary: actualPrimary,
      isDualSecondary: actualSecondary,
      dualLabel,
      startDate: convertExcelDateToJs(parseFloat(shubo.shuboStartDate)),
      endDate: convertExcelDateToJs(parseFloat(shubo.shuboEndDate)),
    };
  });

  // 酛種類変更
  function handleShuboTypeChange(shuboNumber: number, shuboType: string) {
    setAssignments(current => {
      const newMap = new Map(current);
      const existing = newMap.get(shuboNumber) || { shuboType: '速醸', tankId: '' };
      newMap.set(shuboNumber, { ...existing, shuboType });
      return newMap;
    });
  }

  // タンク変更（2個酛ペア連動）
  function handleTankChange(shuboNumber: number, tankId: string) {
    setAssignments(current => {
      const newMap = new Map(current);
      const existing = newMap.get(shuboNumber) || { shuboType: '速醸', tankId: '' };
      newMap.set(shuboNumber, { ...existing, tankId });
      
      // 2個酛の場合はペアも同じタンクに設定
      const shuboIndex = dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber);
      const isDualPrimary = dualShuboFlags[shuboIndex];
      const isDualSecondary = shuboIndex > 0 && dualShuboFlags[shuboIndex - 1];
      
      if (isDualPrimary) {
        // 1番目を変更した場合、2番目も連動
        const nextShubo = dataContext.shuboRawData[shuboIndex + 1];
        if (nextShubo) {
          const nextExisting = newMap.get(nextShubo.shuboNumber) || { shuboType: '速醸', tankId: '' };
          newMap.set(nextShubo.shuboNumber, { ...nextExisting, tankId });
        }
      } else if (isDualSecondary) {
        // 2番目を変更した場合、1番目も連動
        const prevShubo = dataContext.shuboRawData[shuboIndex - 1];
        if (prevShubo) {
          const prevExisting = newMap.get(prevShubo.shuboNumber) || { shuboType: '速醸', tankId: '' };
          newMap.set(prevShubo.shuboNumber, { ...prevExisting, tankId });
        }
      }
      
      return newMap;
    });
  }

  // タンク選択可否判定（修正版）
  function canSelectTank(tankId: string, shuboNumber: number): boolean {
    // 自分が既に選択しているタンクは使用可能
    const currentAssignment = assignments.get(shuboNumber);
    if (currentAssignment?.tankId === tankId) {
      return true;
    }
    
    // 他の酒母が現在選択中のタンクかチェック
    const isUsedByOthers = Array.from(assignments.entries()).some(([num, assignment]) => 
      num !== shuboNumber && assignment.tankId === tankId
    );
    
    if (isUsedByOthers) {
      return false;
    }
    
    // 設定済みデータとの日程重複チェック
    const currentShubo = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
    if (!currentShubo) return true;
    
    const currentStartDate = convertExcelDateToJs(parseFloat(currentShubo.shuboStartDate));
    
    const configuredUsage = dataContext.configuredShuboData.filter(config => 
      config.selectedTankId === tankId && config.shuboNumber !== shuboNumber
    );
    
    // 日程重複チェック
    for (const config of configuredUsage) {
      // 新しい仕込み開始日が既存の卸日より後なら使用可能
      if (currentStartDate <= config.shuboEndDate) {
        return false; // 期間重複
      }
    }
    
    return true;
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
      // 最新の卸日を取得
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
      recipe,
      water: waterAmount,
      lacticAcid: lacticAmount,
      waterDisplay: `${waterAmount}L`,
      lacticDisplay: `${lacticAmount}ml`
    };
  }

  // タンク情報計算（タンク選択後）
  function getTankData(shuboNumber: number) {
    const assignment = assignments.get(shuboNumber);
    if (!assignment?.tankId) return null;

    const recipeData = getRecipeData(shuboNumber);
    if (!recipeData) return null;

    const tankConversions = dataContext.getTankConversions(assignment.tankId);
    const maxCapacity = tankConversions.find(conv => conv.kensyaku === 0)?.capacity || 0;
    const waterKensyaku = convertCapacityToKensyaku(tankConversions, recipeData.water) || 0;

    return {
      tankDisplayName: `${assignment.tankId} (${maxCapacity}L)`,
      maxCapacity,
      waterKensyaku,
      waterCapacity: recipeData.water
    };
  }

  // 一括保存
  function saveAllAssignments() {
    let savedCount = 0;

    assignments.forEach((assignment, shuboNumber) => {
      if (!assignment.shuboType || !assignment.tankId) return;

      const shuboData = dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber);
      if (!shuboData) return;

      const recipeData = getRecipeData(shuboNumber);
      const tankData = getTankData(shuboNumber);
      if (!recipeData || !tankData) return;

      const isDualShubo = dualShuboFlags[dataContext.shuboRawData.findIndex(s => s.shuboNumber === shuboNumber)];
      const nextShubo = isDualShubo ? dataContext.shuboRawData.find(s => s.shuboNumber === shuboNumber + 1) : null;

      const configuredData: ConfiguredShuboData = {
        shuboNumber,
        displayName: isDualShubo && nextShubo ? 
          `${shuboNumber}・${nextShubo.shuboNumber}号` : 
          `${shuboNumber}号`,
        selectedTankId: assignment.tankId,
        shuboType: assignment.shuboType,
        shuboStartDate: convertExcelDateToJs(parseFloat(shuboData.shuboStartDate)),
        shuboEndDate: convertExcelDateToJs(parseFloat(shuboData.shuboEndDate)),
        shuboDays: shuboData.shuboDays,
        recipeData: {
          totalRice: recipeData.recipe.recipeTotalRice,
          steamedRice: recipeData.recipe.steamedRice,
          kojiRice: recipeData.recipe.kojiRice,
          water: recipeData.recipe.water,
          measurement: recipeData.recipe.measurement,
          lacticAcid: recipeData.recipe.lacticAcid,
        },
        tankData: tankData,
        dualShuboInfo: {
          isDualShubo,
          primaryNumber: shuboNumber,
          secondaryNumber: nextShubo?.shuboNumber,
          combinedDisplayName: isDualShubo && nextShubo ? 
            `${shuboNumber}・${nextShubo.shuboNumber}号` : 
            `${shuboNumber}号`
        },
        originalData: shuboData
      };

      dataContext.saveConfiguredShubo(configuredData);
      savedCount++;
    });

    alert(`${savedCount}件の酒母設定を保存しました`);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">タンク割り当て</h2>
        <p className="text-gray-600 mb-4">
          各酒母の酛種類とタンクを選択してください。2個酛は自動で統合表示されます。
        </p>
        <div className="text-sm text-gray-500">
          酒母データ: {dataContext.shuboRawData.length}件 | 
          有効タンク: {enabledTanks.length}個 | 
          表示酒母: {displayShuboData.length}行
        </div>
      </div>

      {/* 酒母一覧・設定テーブル */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">酒母スケジュール・設定</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-300 px-2 py-2">順号</th>
                <th className="border border-gray-300 px-2 py-2">仕込規模</th>
                <th className="border border-gray-300 px-2 py-2">仕込区分</th>
                <th className="border border-gray-300 px-2 py-2">仕込日</th>
                <th className="border border-gray-300 px-2 py-2">卸日</th>
                <th className="border border-gray-300 px-2 py-2">日順</th>
                <th className="border border-gray-300 px-2 py-2">酵母</th>
                <th className="border border-gray-300 px-2 py-2">モト総米</th>
                <th className="border border-gray-300 px-2 py-2 bg-blue-50">酛種類</th>
                <th className="border border-gray-300 px-2 py-2 bg-blue-50">タンク</th>
                <th className="border border-gray-300 px-2 py-2 bg-green-50">汲み水</th>
                <th className="border border-gray-300 px-2 py-2 bg-green-50">検尺</th>
                <th className="border border-gray-300 px-2 py-2 bg-green-50">乳酸</th>
                <th className="border border-gray-300 px-2 py-2 bg-yellow-50">2個酛</th>
              </tr>
            </thead>
            <tbody>
              {displayShuboData.map((shubo) => {
                const assignment = assignments.get(shubo.shuboNumber) || { shuboType: '速醸', tankId: '' };
                const recipeData = getRecipeData(shubo.shuboNumber);
                const tankData = getTankData(shubo.shuboNumber);
                
                return (
                  <tr key={shubo.shuboNumber} className={shubo.isDualShubo ? 'bg-yellow-50' : ''}>
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold">
                      {shubo.shuboNumber}号
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{shubo.brewingScale}kg</td>
                    <td className="border border-gray-300 px-2 py-2">{shubo.brewingCategory}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {formatShortDate(shubo.startDate)}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {formatShortDate(shubo.endDate)}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{shubo.shuboDays}日</td>
                    <td className="border border-gray-300 px-2 py-2">{shubo.yeast}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {shubo.isDualShubo ? `${shubo.shuboTotalRice / 2}kg` : `${shubo.shuboTotalRice}kg`}
                    </td>
                    
                    {/* 酛種類選択 */}
                    <td className="border border-gray-300 px-2 py-2 bg-blue-50">
                      <select
                        value={assignment.shuboType}
                        onChange={(e) => handleShuboTypeChange(shubo.shuboNumber, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="速醸">速醸</option>
                        <option value="高温糖化">高温糖化</option>
                      </select>
                    </td>
                    
                    {/* タンク選択 - 2個酛はペアで同じタンクのみ選択可能 */}
                    <td className="border border-gray-300 px-2 py-2 bg-blue-50">
                      <select
                        value={assignment.tankId}
                        onChange={(e) => handleTankChange(shubo.shuboNumber, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                        disabled={shubo.isDualSecondary} // 2個酛の2番目は自動設定
                      >
                        <option value="">選択</option>
                        {enabledTanks.map(tank => {
                          const isAvailable = canSelectTank(tank.tankId, shubo.shuboNumber);
                          console.log(`タンク選択判定: ${tank.tankId} -> ${shubo.shuboNumber}号 = ${isAvailable ? '使用可能' : '使用不可'}`);
                          
                          return (
                            <option 
                              key={tank.tankId} 
                              value={tank.tankId}
                              disabled={!isAvailable}
                              className={!isAvailable ? 'text-gray-400' : ''}
                            >
                              {tank.displayName} {!isAvailable ? '(使用不可)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    
                    {/* 計算結果 */}
                    <td className="border border-gray-300 px-2 py-2 text-center bg-green-50">
                      {recipeData ? recipeData.waterDisplay : '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center bg-green-50">
                      {tankData ? `${tankData.waterKensyaku}mm` : '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center bg-green-50">
                      {recipeData ? recipeData.lacticDisplay : '-'}
                    </td>
                    
                    {/* 2個酛列 */}
                    <td className="border border-gray-300 px-2 py-2 text-center bg-yellow-50 text-xs">
                      {shubo.dualLabel || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* 一括保存ボタン */}
        <div className="mt-6 text-center">
          <button
            onClick={saveAllAssignments}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700"
          >
            設定を一括保存
          </button>
        </div>
      </div>

      {/* タンク使用状況テーブル */}
      <div className="bg-white rounded-lg shadow">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">タンク使用状況</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">タンクID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">容量</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状況</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">使用者</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">使用可能日</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">備考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {enabledTanks.map(tank => {
                // 使用中チェック
                const assignmentEntry = Array.from(assignments.entries()).find(([num, assignment]) => assignment.tankId === tank.tankId);
                const configuredEntry = dataContext.configuredShuboData.find(config => config.selectedTankId === tank.tankId);
                
                const isInUse = assignmentEntry || configuredEntry;
                const usedBy = assignmentEntry?.[0] || configuredEntry?.shuboNumber;
                const availableDate = getTankAvailableDate(tank.tankId);
                
                return (
                  <tr key={tank.tankId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {tank.tankId}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{tank.maxCapacity}L</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isInUse 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {isInUse ? '使用中' : '空き'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {usedBy ? `${usedBy}号` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {availableDate}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {tank.isRecommended ? '推奨酒母タンク' : '-'}
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