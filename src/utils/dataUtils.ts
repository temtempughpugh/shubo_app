import type { ShuboRawData, RecipeRawData, TankConversionRawData, ConfiguredShuboData, MergedShuboData, DailyRecordData } from './types';

// Excelシリアル値をJavaScript Dateに変換
export function convertExcelDateToJs(excelDate: number): Date {
  const excelEpoch = new Date(1899, 11, 30);
  const days = Math.floor(excelDate);
  const time = excelDate - days;
  
  const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  
  if (time > 0) {
    date.setTime(date.getTime() + time * 24 * 60 * 60 * 1000);
  }
  
  return date;
}

// 日付表示フォーマット
export function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatDateWithDay(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${formatShortDate(date)}(${days[date.getDay()]})`;
}

export function formatFullDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDateFull(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}(${days[date.getDay()]})`;
}

// 日付をキーに変換
export function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 日別記録生成
export function generateDailyRecords(shubo: MergedShuboData): DailyRecordData[] {
  const records: DailyRecordData[] = [];
  const startDate = new Date(shubo.shuboStartDate);
  const totalDays = shubo.maxShuboDays;

  for (let day = 1; day <= totalDays; day++) {
    const recordDate = new Date(startDate);
    recordDate.setDate(startDate.getDate() + (day - 1));

    let dayLabel = '-';
    if (day === 1) {
      dayLabel = '仕込み';
    } else if (day === 2) {
      dayLabel = '打瀬';
    } else if (day === totalDays) {
      dayLabel = '卸し';
    }

    records.push({
      shuboNumber: shubo.primaryNumber,
      recordDate,
      dayNumber: day,
      dayLabel,
      timeSlot: '1-1',
      temperature: null,
      temperature1: null,
      temperature2: null,
      temperatureAfterHeating: null,
      baume: null,
      acidity: null,
      alcohol: null,
      memo: '',
      isAnalysisDay: false
    });
  }

  return records;
}

// CSV解析
export async function loadCSV(filepath: string): Promise<string[][]> {
  try {
    const response = await fetch(filepath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${filepath}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    const separators = [',', '\t', ';'];
    let bestSeparator = ',';
    let maxColumns = 0;
    
    for (const sep of separators) {
      const testColumns = lines[0]?.split(sep).length || 0;
      if (testColumns > maxColumns) {
        maxColumns = testColumns;
        bestSeparator = sep;
      }
    }
    
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === bestSeparator && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      values.push(current.trim());
      return values;
    });
  } catch (error) {
    console.error('CSV読み込みエラー:', error);
    throw error;
  }
}

// shubo.csv解析
export function parseShuboCSV(csvData: string[][]): ShuboRawData[] {
  const results: ShuboRawData[] = [];
  
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    if (row.length < 10) continue;
    
    const shuboTotalRice = parseInt(row[22]) || 0;
    if (shuboTotalRice === 0) continue;
    
    const shuboData: ShuboRawData = {
      shuboNumber: parseInt(row[0]) || 0,
      brewingScale: parseInt(row[1]) || 0,
      pourDate: row[2] || '',
      brewingCategory: row[3] || '',
      tankNumber: parseInt(row[6]) || 0,
      memo: row[7] || '',
      kojiRiceVariety: row[11] || '',
      kakeRiceVariety: row[17] || '',
      shuboTotalRice: shuboTotalRice,
      shuboStartDate: row[23] || '',
      shuboEndDate: row[24] || '',
      shuboDays: parseInt(row[25]) || 0,
      yeast: row[26] || '',
    };
    
    results.push(shuboData);
  }
  
  return results;
}

// shubo_sikomi.csv解析
export function parseRecipeCSV(csvData: string[][]): RecipeRawData[] {
  const results: RecipeRawData[] = [];
  
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    if (row.length < 8) continue;
    
    const recipeData: RecipeRawData = {
      shuboType: row[0] || '',
      recipeBrewingScale: parseInt(row[1]) || 0,
      recipeTotalRice: parseInt(row[2]) || 0,
      steamedRice: parseInt(row[3]) || 0,
      kojiRice: parseInt(row[4]) || 0,
      water: parseInt(row[5]) || 0,
      measurement: parseInt(row[6]) || 0,
      lacticAcid: parseInt(row[7]) || 0,
    };
    
    results.push(recipeData);
  }
  
  return results;
}

// tank_quick_reference.csv解析
export function parseTankConversionCSV(csvData: string[][]): Map<string, TankConversionRawData[]> {
  const tankMap = new Map<string, TankConversionRawData[]>();
  
  if (csvData.length === 0) return tankMap;
  
  const headers = csvData[0];
  const tankSets: Array<{tankCol: number, capacityCol: number, kensyakuCol: number}> = [];
  
  for (let i = 0; i < headers.length; i += 3) {
    if (headers[i] && (headers[i].includes('タンク') || headers[i].includes('No.'))) {
      tankSets.push({
        tankCol: i,
        capacityCol: i + 1,
        kensyakuCol: i + 2
      });
    }
  }
  
  for (let row = 1; row < csvData.length; row++) {
    for (const set of tankSets) {
      const tankId = csvData[row][set.tankCol]?.trim();
      const capacity = parseFloat(csvData[row][set.capacityCol]);
      const kensyaku = parseFloat(csvData[row][set.kensyakuCol]);
      
      if (tankId && !isNaN(capacity) && !isNaN(kensyaku)) {
        if (!tankMap.has(tankId)) {
          tankMap.set(tankId, []);
        }
        
        tankMap.get(tankId)!.push({
          tankId,
          capacity,
          kensyaku
        });
      }
    }
  }
  
  return tankMap;
}

// 配合レシピ検索
export function findRecipe(recipes: RecipeRawData[], shuboType: string, brewingScale: number): RecipeRawData | null {
  const exactMatch = recipes.find(r => 
    r.shuboType === shuboType && r.recipeBrewingScale === brewingScale
  );
  
  if (exactMatch) return exactMatch;
  
  const typeMatches = recipes.filter(r => r.shuboType === shuboType);
  const smallerScales = typeMatches.filter(r => r.recipeBrewingScale <= brewingScale);
  
  if (smallerScales.length > 0) {
    return smallerScales.reduce((best, current) => 
      current.recipeBrewingScale > best.recipeBrewingScale ? current : best
    );
  }
  
  return null;
}

// 容量変換
export function convertCapacityToKensyaku(
  tankConversions: TankConversionRawData[], 
  targetCapacity: number
): number | null {
  const exactMatch = tankConversions.find(row => row.capacity === targetCapacity);
  if (exactMatch) return exactMatch.kensyaku;
  
  const validRows = tankConversions.filter(row => row.capacity <= targetCapacity);
  if (validRows.length === 0) return null;
  
  return validRows.reduce((best, current) => 
    current.capacity > best.capacity ? current : best
  ).kensyaku;
}

export function convertKensyakuToCapacity(
  tankConversions: TankConversionRawData[],
  kensyaku: number
): number | null {
  const match = tankConversions.find(row => row.kensyaku === kensyaku);
  return match ? match.capacity : null;
}

// 2個酛判定（Raw Data用・旧バージョン - 互換性のため残す）
export function checkDualShubo(shuboList: ShuboRawData[]): boolean[] {
  const isDualFlags = new Array(shuboList.length).fill(false);
  
  for (let i = 0; i < shuboList.length - 1; i++) {
    if (isDualFlags[i]) continue;
    
    const current = shuboList[i];
    const next = shuboList[i + 1];
    
    const isConsecutive = next.shuboNumber === current.shuboNumber + 1;
    const isSameDate = current.shuboStartDate === next.shuboStartDate;
    
    if (isConsecutive && isSameDate && current.shuboStartDate !== '' && next.shuboStartDate !== '') {
      isDualFlags[i] = true;
      isDualFlags[i + 1] = true;
    }
  }
  
  return isDualFlags;
}

// ConfiguredShuboDataから2個酛を判定（新バージョン）
export function checkDualShuboFromConfigured(
  configuredList: ConfiguredShuboData[]
): Map<number, { isDual: boolean; isPrimary: boolean; pairNumber: number | null }> {
  const dualMap = new Map<number, { isDual: boolean; isPrimary: boolean; pairNumber: number | null }>();
  
  configuredList.forEach(shubo => {
    dualMap.set(shubo.shuboNumber, { isDual: false, isPrimary: false, pairNumber: null });
  });
  
  const sortedList = [...configuredList].sort((a, b) => a.shuboNumber - b.shuboNumber);
  
  for (let i = 0; i < sortedList.length - 1; i++) {
    const current = sortedList[i];
    const next = sortedList[i + 1];
    
    const isConsecutive = next.shuboNumber === current.shuboNumber + 1;
    const sameTank = current.selectedTankId === next.selectedTankId;
    const currentDate = current.shuboStartDate instanceof Date 
      ? current.shuboStartDate 
      : new Date(current.shuboStartDate);
    const nextDate = next.shuboStartDate instanceof Date 
      ? next.shuboStartDate 
      : new Date(next.shuboStartDate);
    const sameStartDate = currentDate.getTime() === nextDate.getTime();
    
    if (isConsecutive && sameTank && sameStartDate) {
      dualMap.set(current.shuboNumber, { 
        isDual: true, 
        isPrimary: true, 
        pairNumber: next.shuboNumber 
      });
      dualMap.set(next.shuboNumber, { 
        isDual: true, 
        isPrimary: false, 
        pairNumber: current.shuboNumber 
      });
    }
  }
  
  return dualMap;
}

// 統合酒母データを生成
export function createMergedShuboData(
  configuredList: ConfiguredShuboData[]
): MergedShuboData[] {
  const dualMap = checkDualShuboFromConfigured(configuredList);
  const mergedList: MergedShuboData[] = [];
  const processed = new Set<number>();
  
  const sortedList = [...configuredList].sort((a, b) => a.shuboNumber - b.shuboNumber);
  
  for (const shubo of sortedList) {
    if (processed.has(shubo.shuboNumber)) continue;
    
    const dualInfo = dualMap.get(shubo.shuboNumber);
    
    if (dualInfo?.isDual && dualInfo.isPrimary) {
      const secondary = configuredList.find(s => s.shuboNumber === dualInfo.pairNumber);
      if (!secondary) continue;
      
      const mergedData: MergedShuboData = {
        displayName: `${shubo.shuboNumber}・${secondary.shuboNumber}号`,
        selectedTankId: shubo.selectedTankId,
        shuboType: shubo.shuboType,
        primaryNumber: shubo.shuboNumber,
        secondaryNumber: secondary.shuboNumber,
        shuboStartDate: shubo.shuboStartDate,
        shuboEndDates: [shubo.shuboEndDate, secondary.shuboEndDate],
        maxShuboDays: Math.max(shubo.shuboDays, secondary.shuboDays),
        recipeData: {
          totalRice: shubo.recipeData.totalRice + secondary.recipeData.totalRice,
          steamedRice: shubo.recipeData.steamedRice + secondary.recipeData.steamedRice,
          kojiRice: shubo.recipeData.kojiRice + secondary.recipeData.kojiRice,
          water: shubo.recipeData.water + secondary.recipeData.water,
          measurement: shubo.recipeData.measurement + secondary.recipeData.measurement,
          lacticAcid: shubo.recipeData.lacticAcid + secondary.recipeData.lacticAcid
        },
        tankData: shubo.tankData,
        originalData: [shubo.originalData, secondary.originalData]
      };
      
      mergedList.push(mergedData);
      processed.add(shubo.shuboNumber);
      processed.add(secondary.shuboNumber);
      
    } else if (!dualInfo?.isDual) {
      const mergedData: MergedShuboData = {
        displayName: `${shubo.shuboNumber}号`,
        selectedTankId: shubo.selectedTankId,
        shuboType: shubo.shuboType,
        primaryNumber: shubo.shuboNumber,
        secondaryNumber: shubo.shuboNumber,
        shuboStartDate: shubo.shuboStartDate,
        shuboEndDates: [shubo.shuboEndDate],
        maxShuboDays: shubo.shuboDays,
        recipeData: shubo.recipeData,
        tankData: shubo.tankData,
        originalData: [shubo.originalData]
      };
      
      mergedList.push(mergedData);
      processed.add(shubo.shuboNumber);
    }
  }
  
  return mergedList;
}

// ConfiguredShuboDataの表示名を更新（タンク割り当て画面用）
export function updateDualShuboDisplayNames(
  configuredList: ConfiguredShuboData[]
): ConfiguredShuboData[] {
  const dualMap = checkDualShuboFromConfigured(configuredList);
  
  return configuredList.map(shubo => {
    const dualInfo = dualMap.get(shubo.shuboNumber);
    
    if (dualInfo?.isDual) {
      const pairNumber = dualInfo.pairNumber!;
      const displayName = dualInfo.isPrimary 
        ? `${shubo.shuboNumber}・${pairNumber}号 (1/2)`
        : `${pairNumber}・${shubo.shuboNumber}号 (2/2)`;
      
      return {
        ...shubo,
        displayName,
        dualShuboInfo: {
          isDualShubo: true,
          isPrimary: dualInfo.isPrimary,
          primaryNumber: dualInfo.isPrimary ? shubo.shuboNumber : pairNumber,
          secondaryNumber: dualInfo.isPrimary ? pairNumber : shubo.shuboNumber,
          combinedDisplayName: dualInfo.isPrimary 
            ? `${shubo.shuboNumber}・${pairNumber}号`
            : `${pairNumber}・${shubo.shuboNumber}号`
        }
      };
    }
    
    return {
      ...shubo,
      displayName: `${shubo.shuboNumber}号`,
      dualShuboInfo: {
        isDualShubo: false,
        isPrimary: true,
        primaryNumber: shubo.shuboNumber,
        secondaryNumber: undefined,
        combinedDisplayName: `${shubo.shuboNumber}号`
      }
    };
  });
}

// 2個酛統合表示（旧関数・互換性のため残す）
export function formatDualValue(isDual: boolean, total: number, unit: string): string {
  if (!isDual) return `${total}${unit}`;
  const individual = total / 2;
  return `${total}(${individual}+${individual})${unit}`;
}