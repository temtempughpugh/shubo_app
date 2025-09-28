// CSVロードデータ（Raw Data）
export interface ShuboRawData {
  shuboNumber: number;
  brewingScale: number;
  pourDate: string;
  brewingCategory: string;
  tankNumber: number;
  memo: string;
  kojiRiceVariety: string;
  kakeRiceVariety: string;
  shuboTotalRice: number;
  shuboStartDate: string;
  shuboEndDate: string;
  shuboDays: number;
  yeast: string;
}

export interface RecipeRawData {
  shuboType: string;
  recipeBrewingScale: number;
  recipeTotalRice: number;
  steamedRice: number;
  kojiRice: number;
  water: number;
  measurement: number;
  lacticAcid: number;
}

export interface TankConversionRawData {
  tankId: string;
  kensyaku: number;
  capacity: number;
}

// 設定済み酒母データ（Processed Data）
export interface ConfiguredShuboData {
  shuboNumber: number;
  displayName: string;
  selectedTankId: string;
  shuboType: string;
  shuboStartDate: Date;
  shuboEndDate: Date;
  shuboDays: number;
  recipeData: {
    totalRice: number;
    steamedRice: number;
    kojiRice: number;
    water: number;
    measurement: number;
    lacticAcid: number;
  };
  tankData: {
    tankDisplayName: string;
    maxCapacity: number;
    waterKensyaku: number;
    waterCapacity: number;
  };
  dualShuboInfo: {
    isDualShubo: boolean;
    primaryNumber: number;
    secondaryNumber?: number;
    combinedDisplayName: string;
  };
  originalData: ShuboRawData;
}

// 日別記録データ
export interface DailyRecordData {
  shuboNumber: number;
  recordDate: Date;
  dayNumber: number;
  dayLabel: string;
  timeSlot: string;
  temperature: number | null;
  temperatureAfterHeating: number | null;
  baume: number | null;
  acidity: number | null;
  alcohol: number | null;
  memo: string;
  isAnalysisDay: boolean;
}

// タンク設定データ
export interface TankConfigData {
  tankId: string;
  displayName: string;
  maxCapacity: number;
  isEnabled: boolean;
  isRecommended: boolean;
  currentStatus: string;
  availableDate: Date | null;
  memo: string;
}

// localStorage キー
export const STORAGE_KEYS = {
  CONFIGURED_SHUBO_DATA: "shubo_configured_data",
  DAILY_RECORDS_DATA: "shubo_daily_records",
  TANK_CONFIG_DATA: "shubo_tank_config",
  ANALYSIS_SCHEDULE: "shubo_analysis_schedule",
  APP_SETTINGS: "shubo_app_settings",
} as const;

// 推奨酒母タンクリスト
export const RECOMMENDED_SHUBO_TANKS = [
  "No.650", "No.552", "No.550", "No.57", "No.59", "No.60", "No.61",
  "No.801", "No.803", "No.506", "No.802", "No.804", "No.115",
  "No.502", "No.503", "No.504", "No.505", "No.301", "No.501",
  "No.22", "No.23", "No.508"
] as const;

// デフォルト分析日設定
export const DEFAULT_ANALYSIS_DAYS = {
  speed: [2, 7, 9, "discharge"],
  highTemp: [2, 5, 7, "discharge"],
} as const;