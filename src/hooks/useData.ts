import { useState, useEffect } from 'react';
import type { 
  ShuboRawData, 
  RecipeRawData, 
  TankConversionRawData, 
  ConfiguredShuboData,
  MergedShuboData,
  TankConfigData,
  DailyRecordData 
} from '../utils/types';
import { STORAGE_KEYS, RECOMMENDED_SHUBO_TANKS } from '../utils/types';
import { 
  loadCSV, 
  parseShuboCSV, 
  parseRecipeCSV, 
  parseTankConversionCSV,
  createMergedShuboData,
  updateDualShuboDisplayNames
} from '../utils/dataUtils';
import { useLocalStorage } from './useLocalStorage';

export function useData() {
  // CSV Raw Data
  // CSV Raw Data
  const [shuboRawData, setShuboRawData] = useLocalStorage<ShuboRawData[]>(
    STORAGE_KEYS.SHUBO_RAW_DATA,
    []
  );
  const [recipeRawData, setRecipeRawData] = useLocalStorage<RecipeRawData[]>(
    'shubo_recipe_data',
    []
  );
  const [tankConversionMap, setTankConversionMap] = useState<Map<string, TankConversionRawData[]>>(new Map());
  
  // Processed Data (localStorage)
  const [configuredShuboData, setConfiguredShuboData] = useLocalStorage<ConfiguredShuboData[]>(
    STORAGE_KEYS.CONFIGURED_SHUBO_DATA, 
    []
  );
  const [mergedShuboData, setMergedShuboData] = useLocalStorage<MergedShuboData[]>(
    STORAGE_KEYS.MERGED_SHUBO_DATA,
    []
  );
  const [tankConfigData, setTankConfigData] = useLocalStorage<TankConfigData[]>(
    STORAGE_KEYS.TANK_CONFIG_DATA, 
    []
  );
  const [dailyRecordsData, setDailyRecordsData] = useLocalStorage<DailyRecordData[]>(
    STORAGE_KEYS.DAILY_RECORDS_DATA, 
    []
  );
  
  // Loading状態
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // CSV読み込み
  useEffect(() => {
    loadAllCSVData();
  }, []);

  // configuredShuboDataが変更されたら統合データを更新
  useEffect(() => {
    if (configuredShuboData.length > 0) {
      // 表示名を更新
      const updatedConfigured = updateDualShuboDisplayNames(configuredShuboData);
      const hasChanged = JSON.stringify(updatedConfigured) !== JSON.stringify(configuredShuboData);
      
      if (hasChanged) {
        setConfiguredShuboData(updatedConfigured);
      }
      
      // 統合データを生成
      const merged = createMergedShuboData(configuredShuboData);
      setMergedShuboData(merged);
    }
  }, [
    configuredShuboData.length,
    configuredShuboData.map(s => `${s.shuboNumber}-${s.selectedTankId}-${s.shuboStartDate}`).join(',')
  ]);

  // recipeRawDataが変更されたら、configuredShuboDataのrecipeDataを更新
  useEffect(() => {
    if (recipeRawData.length > 0 && configuredShuboData.length > 0) {
      const updatedConfigured = configuredShuboData.map(shubo => {
        const recipe = recipeRawData.find(r => 
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
              measurement: recipe.measurement,
              lacticAcid: recipe.lacticAcid
            }
          };
        }
        return shubo;
      });
      
      // 変更があった場合のみ更新
      if (JSON.stringify(updatedConfigured) !== JSON.stringify(configuredShuboData)) {
        setConfiguredShuboData(updatedConfigured);
      }
    }
  }, [recipeRawData.length, JSON.stringify(recipeRawData)]);  // ← ここを修正

  async function loadAllCSVData() {
  try {
    setIsLoading(true);
    setLoadError(null);

    // useLocalStorageが自動で読み込むので、データが空の時だけCSVから読み込む
    let parsedShuboData: ShuboRawData[];
    
    if (shuboRawData.length === 0) {
      // 初回のみCSVファイルから読み込み
      const shuboCSV = await loadCSV('/data/shubo.csv');
      parsedShuboData = parseShuboCSV(shuboCSV);
      setShuboRawData(parsedShuboData); // useLocalStorageが自動保存
    } else {
      // 既にuseLocalStorageで読み込まれている
      parsedShuboData = shuboRawData;
    }

    const [recipeCSV, tankCSV] = await Promise.all([
      loadCSV('/data/shubo_sikomi.csv'),
      loadCSV('/data/tank_quick_reference.csv')
    ]);

    const parsedTankMap = parseTankConversionCSV(tankCSV);
    setTankConversionMap(parsedTankMap);

    // recipeRawDataが空の場合のみCSVから読み込み
    if (recipeRawData.length === 0) {
      const parsedRecipeData = parseRecipeCSV(recipeCSV);
      setRecipeRawData(parsedRecipeData); // useLocalStorageが自動保存
    }

    if (tankConfigData.length === 0) {
      initializeTankConfig(parsedTankMap);
    }

    console.log('CSV読み込み完了:', {
      酒母データ: parsedShuboData.length,
      レシピデータ: recipeRawData.length,
      タンクデータ: parsedTankMap.size
    });

    } catch (error) {
      console.error('CSV読み込みエラー:', error);
      setLoadError(error instanceof Error ? error.message : 'データ読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  function initializeTankConfig(tankMap: Map<string, TankConversionRawData[]>) {
    const tankConfigs: TankConfigData[] = [];

    tankMap.forEach((conversions, tankId) => {
      if (conversions.length === 0) return;

      const maxCapacityData = conversions.find(conv => conv.kensyaku === 0);
      const maxCapacity = maxCapacityData?.capacity || 0;

      const isRecommended = RECOMMENDED_SHUBO_TANKS.includes(tankId as any);

      const tankConfig: TankConfigData = {
        tankId,
        displayName: `${tankId} (${maxCapacity}L)`,
        maxCapacity,
        isEnabled: isRecommended,
        isRecommended,
        currentStatus: '空き',
        availableDate: null,
        memo: ''
      };

      tankConfigs.push(tankConfig);
    });

    tankConfigs.sort((a, b) => b.maxCapacity - a.maxCapacity);
    setTankConfigData(tankConfigs);
  }

  function getTankConversions(tankId: string): TankConversionRawData[] {
    return tankConversionMap.get(tankId) || [];
  }

  function getEnabledTanks(): TankConfigData[] {
    return tankConfigData.filter(tank => tank.isEnabled);
  }

  function getRecommendedTanks(): TankConfigData[] {
    return tankConfigData.filter(tank => tank.isRecommended);
  }

  function updateTankConfig(tankId: string, updates: Partial<TankConfigData>) {
    setTankConfigData(current => 
      current.map(tank => 
        tank.tankId === tankId ? { ...tank, ...updates } : tank
      )
    );
  }

  function saveConfiguredShubo(data: ConfiguredShuboData) {
    setConfiguredShuboData(current => {
      const index = current.findIndex(item => item.shuboNumber === data.shuboNumber);
      if (index >= 0) {
        const updated = [...current];
        updated[index] = data;
        return updated;
      } else {
        return [...current, data];
      }
    });
  }

  function removeConfiguredShubo(shuboNumber: number) {
    setConfiguredShuboData(current => 
      current.filter(item => item.shuboNumber !== shuboNumber)
    );
  }

  function updateDailyRecord(record: DailyRecordData) {
    setDailyRecordsData(current => {
      const index = current.findIndex(item => 
  item.shuboNumber === record.shuboNumber &&
  item.dayNumber === record.dayNumber
);

      if (index >= 0) {
        const updated = [...current];
        updated[index] = record;
        return updated;
      } else {
        return [...current, record];
      }
    });
  }

  function getDailyRecords(shuboNumber: number): DailyRecordData[] {
    return dailyRecordsData.filter(record => record.shuboNumber === shuboNumber);
  }

  return {
    // Raw Data
    shuboRawData,
    setShuboRawData,
    recipeRawData,
    setRecipeRawData,  // ← 追加
    tankConversionMap,
    
    // Processed Data
    configuredShuboData,
    mergedShuboData,
    tankConfigData,
    dailyRecordsData,
    
    // Loading状態
    isLoading,
    loadError,
    
    // ヘルパー関数
    getTankConversions,
    getEnabledTanks,
    getRecommendedTanks,
    updateTankConfig,
    saveConfiguredShubo,
    removeConfiguredShubo,
    updateDailyRecord,
    getDailyRecords,
    
    // 再読み込み
    reloadData: loadAllCSVData,
  };
}