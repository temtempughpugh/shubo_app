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
  fiscalYear: number;  // ← 追加
  shuboStorage: string;  // ← 追加
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
  // 新規追加
  初添_総米: number | null;
  初添_掛米: number | null;
  初添_麹米: number | null;
  初添_汲み水: number | null;
  仲添_総米: number | null;
  仲添_掛米: number | null;
  仲添_麹米: number | null;
  仲添_汲み水: number | null;
  留添_総米: number | null;
  留添_掛米: number | null;
  留添_麹米: number | null;
  留添_汲み水: number | null;
  三段総米: number | null;
  留までの汲水歩合: number | null;
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
  fiscalYear: number;  // ← 追加
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
  fiscalYear: number;  // ← 追加
  recipeData: {
    totalRice: number;
    steamedRice: number;
    kojiRice: number;
    water: number;
    measurement: number;
    lacticAcid: number;
  };
  individualRecipeData: {
    totalRice: number;
    steamedRice: number;
    kojiRice: number;
    water: number;
    measurement: number;
    lacticAcid: number;
  }[];
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
  fiscalYear: number;  // ← 追加
  temperature: number | null;  // 既存（互換性のため残す）
  temperature1: number | null;  // 品温① (1日目→水麹温度, 2日目以降→品温)
  temperature2: number | null;  // 品温② (1日目→仕込温度, 2日目以降→連動なし)
  temperature3: number | null;  // 品温③ (午後)
  temperatureAfterHeating: number | null;  // 既存（互換性のため残す）
  baume: number | null;
  acidity: number | null;
  alcohol: number | null;
  memo: string;
  isAnalysisDay: boolean;
}

// 日付ラベル選択肢
export const DAY_LABEL_OPTIONS = ['-', '暖気', '分け','卸し'] as const;
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

// CSV更新履歴
export interface CSVUpdateHistory {
  updateDate: Date;      // 更新日
  executedAt: Date;      // 実行日時
  updatedCount: number;  // 更新件数
  keptCount: number;     // 保持件数
}

// localStorage キー
export const STORAGE_KEYS = {
SHUBO_RAW_DATA: "shubo_raw_data",
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
  ANALYSIS_SETTINGS: "shubo_analysis_settings",
  CSV_UPDATE_HISTORY: "shubo_csv_update_history",
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

// 分析日設定
export interface AnalysisSettings {
  speed: number[];      // 速醸のデフォルト分析日
  highTemp: number[];   // 高温糖化のデフォルト分析日
  baumePrediction: BaumePredictionSettings;  // ボーメ予測警告設定
}

// ボーメ予測警告設定
// ボーメ予測警告設定
export interface BaumePredictionSettings {
  single: {
    daysBeforeDischarge1: number | null;  // 卸日1日前（常に赤、nullで無効）
    daysBeforeDischarge2Low: number;   // 卸日2日前の赤閾値
    daysBeforeDischarge2High: number;  // 卸日2日前のオレンジ閾値
    daysBeforeDischarge3Low: number;   // 卸日3日前の赤閾値
    daysBeforeDischarge3High: number;  // 卸日3日前のオレンジ閾値
    daysBeforeDischarge4Low: number;   // 卸日4日前の赤閾値
    daysBeforeDischarge4High: number;  // 卸日4日前のオレンジ閾値
    daysBeforeDischarge5Low: number;   // 卸日5日前の赤閾値
    daysBeforeDischarge5High: number;  // 卸日5日前のオレンジ閾値
  };
  dual: {
    daysBeforeDischarge1: number | null;  // 卸日1日前（常に赤、nullで無効）
    daysBeforeDischarge2: number | null;  // 卸日2日前（常に赤、nullで無効）
    daysBeforeDischarge3: number | null;  // 卸日3日前（常に赤、nullで無効）
    daysBeforeDischarge4Low: number;   // 卸日4日前の赤閾値
    daysBeforeDischarge4High: number;  // 卸日4日前のオレンジ閾値
    daysBeforeDischarge5Low: number;   // 卸日5日前の赤閾値
    daysBeforeDischarge5High: number;  // 卸日5日前のオレンジ閾値
    daysBeforeDischarge6Low: number;   // 卸日6日前の赤閾値
    daysBeforeDischarge6High: number;  // 卸日6日前のオレンジ閾値
  };
}

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  speed: [2, 6, 9],
  highTemp: [2, 5, 7],
  baumePrediction: {
    single: {
      daysBeforeDischarge1: null,
      daysBeforeDischarge2Low: 7.5,
      daysBeforeDischarge2High: 8.0,
      daysBeforeDischarge3Low: 8.0,
      daysBeforeDischarge3High: 8.5,
      daysBeforeDischarge4Low: 8.5,
      daysBeforeDischarge4High: 9.0,
      daysBeforeDischarge5Low: 9.0,
      daysBeforeDischarge5High: 9.5
    },
    dual: {
      daysBeforeDischarge1: null,
      daysBeforeDischarge2: null,
      daysBeforeDischarge3: null,
      daysBeforeDischarge4Low: 7.5,
      daysBeforeDischarge4High: 8.5,
      daysBeforeDischarge5Low: 8.0,
      daysBeforeDischarge5High: 9.0,
      daysBeforeDischarge6Low: 8.5,
      daysBeforeDischarge6High: 9.5
    }
  }
};

// 複合キー型（順号-年度形式）
export type ShuboKey = `${number}-${number}`;

// 複合キーを生成するヘルパー関数
export function createShuboKey(shuboNumber: number, fiscalYear: number): ShuboKey {
  return `${shuboNumber}-${fiscalYear}`;
}

// 複合キーから順号と年度を取得するヘルパー関数
export function parseShuboKey(key: ShuboKey): { shuboNumber: number; fiscalYear: number } {
  const [shuboNumber, fiscalYear] = key.split('-').map(Number);
  return { shuboNumber, fiscalYear };
}