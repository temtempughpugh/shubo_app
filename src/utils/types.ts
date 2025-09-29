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
    isPrimary: boolean;
    primaryNumber: number;
    secondaryNumber?: number;
    combinedDisplayName: string;
  };
  originalData: ShuboRawData;
}

// 統合酒母データ（ダッシュボード・酒母一覧用）
export interface MergedShuboData {
  displayName: string;
  selectedTankId: string;
  shuboType: string;
  primaryNumber: number;
  secondaryNumber: number;
  shuboStartDate: Date;
  shuboEndDates: Date[];
  maxShuboDays: number;
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
  originalData: ShuboRawData[];
}

// 日別記録データ
// 日別記録データ
export interface DailyRecordData {
  shuboNumber: number;
  recordDate: Date;
  dayNumber: number;
  dayLabel: string;
  timeSlot: string;
  temperature: number | null;  // 既存（互換性のため残す）
  temperature1: number | null;  // 品温① (1日目→水麹温度, 2日目以降→品温)
  temperature2: number | null;  // 品温② (1日目→仕込温度, 2日目以降→連動なし)
  temperatureAfterHeating: number | null;  // 既存（互換性のため残す）
  baume: number | null;
  acidity: number | null;
  alcohol: number | null;
  memo: string;
  isAnalysisDay: boolean;
}

// 日付ラベル選択肢
export const DAY_LABEL_OPTIONS = ['-', '暖気', '分け'] as const;
export type DayLabelOption = typeof DAY_LABEL_OPTIONS[number];

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

// 日付別環境データ
export interface DailyEnvironmentData {
  date: Date;
  temperature: number | null;
  humidity: number | null;
}

// 仕込み準備データ
export interface BrewingPreparationData {
  shuboNumber: number;
  displayName: string;
  tankId: string;
  waterAmount: number;
  iceAmount: number | null;
  preparationWater: number;
  kensyaku: number | null;
  capacity: number | null;
  lacticAcid: number;
}

// 仕込み予定データ
export interface BrewingScheduleData {
  shuboNumber: number;
  displayName: string;
  tankId: string;
  mizukoujiTemperature: number | null;
  brewingTemperature: number | null;
  afterBrewingKensyaku: number | null;
  capacity: number | null;
}

// 卸し予定データ
export interface DischargeScheduleData {
  shuboNumber: number;
  displayName: string;
  tankId: string;
  beforeDischargeKensyaku: number | null;
  beforeDischargeCapacity: number | null;
  afterDischargeKensyaku: number | null;
  afterDischargeCapacity: number | null;
  dischargeAmount: number | null;
  destinationTank: string | null;
  dischargeWater: number | null;
  expectedMeasurement: number;
  actualMeasurement: number | null;
  measurementRatio: number | null;
}

// localStorage キー
export const STORAGE_KEYS = {
  CONFIGURED_SHUBO_DATA: "shubo_configured_data",
  MERGED_SHUBO_DATA: "shubo_merged_data",
  DAILY_RECORDS_DATA: "shubo_daily_records",
  TANK_CONFIG_DATA: "shubo_tank_config",
  ANALYSIS_SCHEDULE: "shubo_analysis_schedule",
  APP_SETTINGS: "shubo_app_settings",
  DAILY_ENVIRONMENT: "shubo_daily_environment",
  BREWING_PREPARATION: "shubo_brewing_preparation",
  BREWING_SCHEDULE: "shubo_brewing_schedule",
  DISCHARGE_SCHEDULE: "shubo_discharge_schedule",
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