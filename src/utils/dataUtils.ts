import type { ShuboRawData, RecipeRawData, TankConversionRawData } from './types';

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

// CSV解析
export async function loadCSV(filepath: string): Promise<string[][]> {
  try {
    const response = await fetch(filepath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${filepath}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // 区切り文字判定
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
    
    // モト総米が0kgの行は除外
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

// 2個酛判定（重複防止版）
export function checkDualShubo(shuboList: ShuboRawData[]): boolean[] {
  const isDualFlags = new Array(shuboList.length).fill(false);
  
  for (let i = 0; i < shuboList.length - 1; i++) {
    // 既にペアに属している場合はスキップ
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

// 2個酛統合表示
export function formatDualValue(isDual: boolean, total: number, unit: string): string {
  if (!isDual) return `${total}${unit}`;
  const individual = total / 2;
  return `${total}(${individual}+${individual})${unit}`;
}