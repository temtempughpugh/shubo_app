import { useState, useEffect } from 'react';
import type { 
  ShuboRawData, 
  RecipeRawData, 
  TankConversionRawData, 
  ConfiguredShuboData,
  TankConfigData,
  DailyRecordData 
} from '../utils/types';
import { STORAGE_KEYS, RECOMMENDED_SHUBO_TANKS } from '../utils/types';
import { 
  loadCSV, 
  parseShuboCSV, 
  parseRecipeCSV, 
  parseTankConversionCSV,
  convertExcelDateToJs
} from '../utils/dataUtils';
import { useLocalStorage } from './useLocalStorage';

export function useData() {
  // CSV Raw Data
  const [shuboRawData, setShuboRawData] = useState<ShuboRawData[]>([]);
  const [recipeRawData, setRecipeRawData] = useState<RecipeRawData[]>([]);
  const [tankConversionMap, setTankConversionMap] = useState<Map<string, TankConversionRawData[]>>(new Map());
  
  // Processed Data (localStorage)
  const [configuredShuboData, setConfiguredShuboData] = useLocalStorage<ConfiguredShuboData[]>(
    STORAGE_KEYS.CONFIGURED_SHUBO_DATA, 
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

  async function loadAllCSVData() {
    try {
      setIsLoading(true);
      setLoadError(null);

      // 並行してCSV読み込み
      const [shuboCSV, recipeCSV, tankCSV] = await Promise.all([
        loadCSV('/data/shubo.csv'),
        loadCSV('/data/shubo_sikomi.csv'),
        loadCSV('/data/tank_quick_reference.csv')
      ]);

      // データ解析
      const parsedShuboData = parseShuboCSV(shuboCSV);
      const parsedRecipeData = parseRecipeCSV(recipeCSV);
      const parsedTankMap = parseTankConversionCSV(tankCSV);

      setShuboRawData(parsedShuboData);
      setRecipeRawData(parsedRecipeData);
      setTankConversionMap(parsedTankMap);

      // 初回起動時のタンク設定初期化
      if (tankConfigData.length === 0) {
        initializeTankConfig(parsedTankMap);
      }

      console.log('CSV読み込み完了:', {
        酒母データ: parsedShuboData.length,
        レシピデータ: parsedRecipeData.length,
        タンクデータ: parsedTankMap.size
      });

    } catch (error) {
      console.error('CSV読み込みエラー:', error);
      setLoadError(error instanceof Error ? error.message : 'データ読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  // タンク設定初期化
  function initializeTankConfig(tankMap: Map<string, TankConversionRawData[]>) {
    const tankConfigs: TankConfigData[] = [];

    tankMap.forEach((conversions, tankId) => {
      if (conversions.length === 0) return;

      // 最大容量（検尺0mmの容量）
      const maxCapacityData = conversions.find(conv => conv.kensyaku === 0);
      const maxCapacity = maxCapacityData?.capacity || 0;

      // 推奨酒母タンクかどうか
      const isRecommended = RECOMMENDED_SHUBO_TANKS.includes(tankId as any);

      const tankConfig: TankConfigData = {
        tankId,
        displayName: `${tankId} (${maxCapacity}L)`,
        maxCapacity,
        isEnabled: isRecommended, // 推奨タンクはデフォルト有効
        isRecommended,
        currentStatus: '空き',
        availableDate: null,
        memo: ''
      };

      tankConfigs.push(tankConfig);
    });

    // 容量降順でソート
    tankConfigs.sort((a, b) => b.maxCapacity - a.maxCapacity);
    setTankConfigData(tankConfigs);
  }

  // タンク変換取得
  function getTankConversions(tankId: string): TankConversionRawData[] {
    return tankConversionMap.get(tankId) || [];
  }

  // 有効なタンク取得
  function getEnabledTanks(): TankConfigData[] {
    return tankConfigData.filter(tank => tank.isEnabled);
  }

  // 推奨タンク取得
  function getRecommendedTanks(): TankConfigData[] {
    return tankConfigData.filter(tank => tank.isRecommended);
  }

  // タンク設定更新
  function updateTankConfig(tankId: string, updates: Partial<TankConfigData>) {
    setTankConfigData(current => 
      current.map(tank => 
        tank.tankId === tankId ? { ...tank, ...updates } : tank
      )
    );
  }

  // 設定済み酒母データ追加・更新
  function saveConfiguredShubo(data: ConfiguredShuboData) {
    setConfiguredShuboData(current => {
      const index = current.findIndex(item => item.shuboNumber === data.shuboNumber);
      if (index >= 0) {
        // 更新
        const updated = [...current];
        updated[index] = data;
        return updated;
      } else {
        // 新規追加
        return [...current, data];
      }
    });
  }

  // 設定済み酒母データ削除
  function removeConfiguredShubo(shuboNumber: number) {
    setConfiguredShuboData(current => 
      current.filter(item => item.shuboNumber !== shuboNumber)
    );
  }

  // 日別記録更新
  function updateDailyRecord(record: DailyRecordData) {
    setDailyRecordsData(current => {
      const index = current.findIndex(item => 
        item.shuboNumber === record.shuboNumber &&
        item.recordDate.getTime() === record.recordDate.getTime() &&
        item.timeSlot === record.timeSlot
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

  // 酒母の日別記録取得
  function getDailyRecords(shuboNumber: number): DailyRecordData[] {
    return dailyRecordsData.filter(record => record.shuboNumber === shuboNumber);
  }

  return {
    // Raw Data
    shuboRawData,
    recipeRawData,
    tankConversionMap,
    
    // Processed Data
    configuredShuboData,
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