import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { 
  ShuboRawData, 
  ConfiguredShuboData,
  DailyRecordData,
  RecipeRawData,
  TankConfigData,
  TankConversionRawData,
  AnalysisSettings,
  CSVUpdateHistory
} from '../utils/types'
import { DEFAULT_ANALYSIS_SETTINGS } from '../utils/types'
import { calculateFiscalYear } from '../utils/dataUtils'

export function useSupabaseData() {
  const [shuboRawData, setShuboRawDataState] = useState<ShuboRawData[]>([])
  const [configuredShuboData, setConfiguredShuboDataState] = useState<ConfiguredShuboData[]>([])
  const [dailyRecordsData, setDailyRecordsDataState] = useState<DailyRecordData[]>([])
  const [recipeRawData, setRecipeRawDataState] = useState<RecipeRawData[]>([])
  const [tankConfigData, setTankConfigDataState] = useState<TankConfigData[]>([])
  
  const [dailyEnvironment, setDailyEnvironment] = useState<Record<string, { temperature: string; humidity: string }>>({})
const [brewingPreparation, setBrewingPreparation] = useState<Record<string, any>>({})
const [dischargeSchedule, setDischargeSchedule] = useState<Record<string, any>>({})
  const [tankConversionMap, setTankConversionMap] = useState<Map<string, TankConversionRawData[]>>(new Map())
  const [analysisSettings, setAnalysisSettingsState] = useState<AnalysisSettings>(DEFAULT_ANALYSIS_SETTINGS)
  const [csvUpdateHistory, setCsvUpdateHistory] = useState<CSVUpdateHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentFiscalYear, setCurrentFiscalYear] = useState<number>(() => calculateFiscalYear(new Date()))

  // 初回データ読み込み
  useEffect(() => {
    loadAllData()
  }, [])

  // 全データ読み込み
  async function loadAllData() {
    try {
      setIsLoading(true)
      setLoadError(null)

      await Promise.all([
  loadShuboRawData(),
  loadConfiguredShuboData(),
  loadDailyRecordsData(),
  loadRecipeData(),
  loadTankConfig(),
  loadTankConversion(),
  loadAnalysisSettings(),
  loadCsvUpdateHistory()
])

      console.log('全データ読み込み完了')
    } catch (error) {
      console.error('データ読み込みエラー:', error)
      setLoadError(error instanceof Error ? error.message : 'データ読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // === shubo_raw_data ===
  async function loadShuboRawData() {
    const { data, error } = await supabase
      .from('shubo_raw_data')
      .select('*')
      .order('shubo_number', { ascending: true })

    if (error) throw error

    const converted: ShuboRawData[] = (data || []).map((row: any) => ({
      shuboNumber: row.shubo_number,
      fiscalYear: row.fiscal_year,
      brewingScale: row.brewing_scale,
      pourDate: row.pour_date || '',
      brewingCategory: row.brewing_category || '',
      tankNumber: row.tank_number || 0,
      memo: row.memo || '',
      kojiRiceVariety: row.koji_rice_variety || '',
      kakeRiceVariety: row.kake_rice_variety || '',
      shuboTotalRice: row.shubo_total_rice || 0,
      shuboStartDate: row.shubo_start_date || '',
      shuboEndDate: row.shubo_end_date || '',
      shuboDays: row.shubo_days || 0,
      yeast: row.yeast || ''
    }))

    setShuboRawDataState(converted)
  }

  async function saveShuboRawData(data: ShuboRawData[]) {
    const converted = data.map((shubo) => ({
      shubo_number: shubo.shuboNumber,
      fiscal_year: shubo.fiscalYear,
      brewing_scale: shubo.brewingScale,
      pour_date: shubo.pourDate,
      brewing_category: shubo.brewingCategory,
      tank_number: shubo.tankNumber,
      memo: shubo.memo,
      koji_rice_variety: shubo.kojiRiceVariety,
      kake_rice_variety: shubo.kakeRiceVariety,
      shubo_total_rice: shubo.shuboTotalRice,
      shubo_start_date: shubo.shuboStartDate,
      shubo_end_date: shubo.shuboEndDate,
      shubo_days: shubo.shuboDays,
      yeast: shubo.yeast,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('shubo_raw_data')
      .upsert(converted, { onConflict: 'shubo_number,fiscal_year' })

    if (error) throw error
    setShuboRawDataState(data)
  }

  // === shubo_configured_data ===
  // === shubo_configured_data ===
async function loadConfiguredShuboData() {
  const { data, error } = await supabase
    .from('shubo_configured_data')
    .select('*')
    .order('shubo_number', { ascending: true })

  if (error) throw error

  const converted: ConfiguredShuboData[] = (data || []).map((row: any) => ({
    shuboNumber: row.shubo_number,
    fiscalYear: row.fiscal_year,
    selectedTankId: row.selected_tank_id || '',
    shuboType: row.shubo_type || '',
    shuboStartDate: row.shubo_start_date ? new Date(row.shubo_start_date) : new Date(),
    shuboEndDate: row.shubo_end_date ? new Date(row.shubo_end_date) : new Date(),
    shuboDays: row.shubo_days || 0,
    displayName: row.display_name || '',
    recipeData: row.recipe_data || {},
    originalData: row.original_data || {},
    tankData: {
      tankDisplayName: '',
      maxCapacity: 0,
      waterKensyaku: 0,
      waterCapacity: 0
    },
    dualShuboInfo: {
      isDualShubo: false,
      isPrimary: false,
      primaryNumber: row.shubo_number,
      combinedDisplayName: ''
    }
  }))

  setConfiguredShuboDataState(converted)
}

  async function saveConfiguredShuboData(data: ConfiguredShuboData[]) {
    const converted = data.map((shubo) => ({
      shubo_number: shubo.shuboNumber,
      fiscal_year: shubo.fiscalYear,
      selected_tank_id: shubo.selectedTankId,
      shubo_type: shubo.shuboType,
      shubo_start_date: shubo.shuboStartDate.toISOString(),
      shubo_end_date: shubo.shuboEndDate.toISOString(),
      shubo_days: shubo.shuboDays,
      display_name: shubo.displayName,
      recipe_data: shubo.recipeData,
      original_data: shubo.originalData,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('shubo_configured_data')
      .upsert(converted, { onConflict: 'shubo_number,fiscal_year' })

    if (error) throw error
    setConfiguredShuboDataState(data)
  }

  // === shubo_daily_records ===
  async function loadDailyRecordsData() {
    const { data, error } = await supabase
      .from('shubo_daily_records')
      .select('*')
      .order('record_date', { ascending: true })

    if (error) throw error

    const converted: DailyRecordData[] = (data || []).map((row: any) => ({
      shuboNumber: row.shubo_number,
      fiscalYear: row.fiscal_year,
      recordDate: new Date(row.record_date),
      dayNumber: row.day_number || 0,
      dayLabel: row.day_label || '',
      timeSlot: row.time_slot || '',
      temperature: row.temperature,
      temperature1: row.temperature1,
      temperature2: row.temperature2,
      temperature3: row.temperature3,
      temperatureAfterHeating: row.temperature_after_heating,
      baume: row.baume,
      acidity: row.acidity,
      alcohol: row.alcohol,
      memo: row.memo || '',
      isAnalysisDay: row.is_analysis_day || false
    }))

    setDailyRecordsDataState(converted)
  }

  async function saveDailyRecordsData(data: DailyRecordData[]) {
    const converted = data.map((record) => ({
      shubo_number: record.shuboNumber,
      fiscal_year: record.fiscalYear,
      record_date: record.recordDate.toISOString().split('T')[0],
      day_number: record.dayNumber,
      day_label: record.dayLabel,
      time_slot: record.timeSlot,
      temperature: record.temperature,
      temperature1: record.temperature1,
      temperature2: record.temperature2,
      temperature3: record.temperature3,
      temperature_after_heating: record.temperatureAfterHeating,
      baume: record.baume,
      acidity: record.acidity,
      alcohol: record.alcohol,
      memo: record.memo,
      is_analysis_day: record.isAnalysisDay,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('shubo_daily_records')
      .upsert(converted, { onConflict: 'shubo_number,fiscal_year,record_date,time_slot' })

    if (error) throw error
    setDailyRecordsDataState(data)
  }

  // === shubo_recipe_data ===
  async function loadRecipeData() {
    const { data, error } = await supabase
      .from('shubo_recipe_data')
      .select('*')

    if (error) throw error

    const converted: RecipeRawData[] = (data || []).map((row: any) => ({
      shuboType: row.shubo_type,
      recipeBrewingScale: row.recipe_brewing_scale,
      recipeTotalRice: row.recipe_total_rice,
      steamedRice: row.steamed_rice,
      kojiRice: row.koji_rice,
      water: row.water,
      measurement: row.measurement,
      lacticAcid: row.lactic_acid,
      初添_総米: row['初添_総米'],
      初添_掛米: row['初添_掛米'],
      初添_麹米: row['初添_麹米'],
      初添_汲み水: row['初添_汲み水'],
      仲添_総米: row['仲添_総米'],
      仲添_掛米: row['仲添_掛米'],
      仲添_麹米: row['仲添_麹米'],
      仲添_汲み水: row['仲添_汲み水'],
      留添_総米: row['留添_総米'],
      留添_掛米: row['留添_掛米'],
      留添_麹米: row['留添_麹米'],
      留添_汲み水: row['留添_汲み水'],
      三段総米: row['三段総米'],
      留までの汲水歩合: row['留までの汲水歩合']
    }))

    setRecipeRawDataState(converted)
  }

  async function saveRecipeData(data: RecipeRawData[]) {
    const converted = data.map((recipe) => ({
      shubo_type: recipe.shuboType,
      recipe_brewing_scale: recipe.recipeBrewingScale,
      recipe_total_rice: recipe.recipeTotalRice,
      steamed_rice: recipe.steamedRice,
      koji_rice: recipe.kojiRice,
      water: recipe.water,
      measurement: recipe.measurement,
      lactic_acid: recipe.lacticAcid,
      '初添_総米': recipe.初添_総米,
      '初添_掛米': recipe.初添_掛米,
      '初添_麹米': recipe.初添_麹米,
      '初添_汲み水': recipe.初添_汲み水,
      '仲添_総米': recipe.仲添_総米,
      '仲添_掛米': recipe.仲添_掛米,
      '仲添_麹米': recipe.仲添_麹米,
      '仲添_汲み水': recipe.仲添_汲み水,
      '留添_総米': recipe.留添_総米,
      '留添_掛米': recipe.留添_掛米,
      '留添_麹米': recipe.留添_麹米,
      '留添_汲み水': recipe.留添_汲み水,
      '三段総米': recipe.三段総米,
      '留までの汲水歩合': recipe.留までの汲水歩合,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('shubo_recipe_data')
      .upsert(converted, { onConflict: 'shubo_type,recipe_brewing_scale' })

    if (error) throw error
    setRecipeRawDataState(data)
  }

  // === shubo_tank_config ===
  async function loadTankConfig() {
    const { data, error } = await supabase
      .from('shubo_tank_config')
      .select('*')

    if (error) throw error

    const converted: TankConfigData[] = (data || []).map((row: any) => ({
      tankId: row.tank_id,
      displayName: row.display_name,
      maxCapacity: row.max_capacity,
      isEnabled: row.is_enabled,
      isRecommended: row.is_recommended,
      currentStatus: row.current_status || '空き',
      availableDate: row.available_date ? new Date(row.available_date) : null,
      memo: row.memo || ''
    }))

    setTankConfigDataState(converted)
  }

  async function saveTankConfig(data: TankConfigData[]) {
    const converted = data.map((tank) => ({
      tank_id: tank.tankId,
      display_name: tank.displayName,
      max_capacity: tank.maxCapacity,
      is_enabled: tank.isEnabled,
      is_recommended: tank.isRecommended,
      current_status: tank.currentStatus,
      available_date: tank.availableDate?.toISOString().split('T')[0],
      memo: tank.memo,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('shubo_tank_config')
      .upsert(converted, { onConflict: 'tank_id' })

    if (error) throw error
    setTankConfigDataState(data)
  }

 // === shubo_daily_environment ===
// === shubo_daily_environment ===
async function loadDailyEnvironment() {
  const { data, error } = await supabase
    .from('shubo_daily_environment')
    .select('*')
    .order('date', { ascending: true })

  if (error && error.code !== 'PGRST116') {
    console.warn('日付別環境データ読み込みエラー:', error)
    return
  }

  const converted: Record<string, { temperature: string; humidity: string }> = {}
  
  ;(data || []).forEach((row: any) => {
    const dateKey = row.date
    converted[dateKey] = {
      temperature: row.temperature?.toString() || '',
      humidity: row.humidity?.toString() || ''
    }
  })

  setDailyEnvironment(converted)
}

async function saveDailyEnvironment(dateKey: string, temperature: string, humidity: string) {
  const { error } = await supabase
    .from('shubo_daily_environment')
    .upsert({
      date: dateKey,
      temperature: temperature ? parseFloat(temperature) : null,
      humidity: humidity ? parseFloat(humidity) : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'date' })

  if (error) throw error
  
  setDailyEnvironment(prev => ({
    ...prev,
    [dateKey]: { temperature, humidity }
  }))
}

// === shubo_brewing_preparation ===
async function loadBrewingPreparation() {
  const { data, error } = await supabase
    .from('shubo_brewing_preparation')
    .select('*')

  if (error && error.code !== 'PGRST116') {
    console.warn('仕込み準備データ読み込みエラー:', error)
    return
  }

  const converted: Record<string, any> = {}
  
  ;(data || []).forEach((row: any) => {
    const key = `${row.shubo_number}-${row.fiscal_year}`
    converted[key] = {
      iceAmount: row.ice_amount,
      afterBrewingKensyaku: row.after_brewing_kensyaku
    }
  })

  setBrewingPreparation(converted)
}

async function saveBrewingPreparation(shuboNumber: number, fiscalYear: number, data: any) {
  const { error } = await supabase
    .from('shubo_brewing_preparation')
    .upsert({
      shubo_number: shuboNumber,
      fiscal_year: fiscalYear,
      ice_amount: data.iceAmount,
      after_brewing_kensyaku: data.afterBrewingKensyaku,
      updated_at: new Date().toISOString()
    }, { onConflict: 'shubo_number,fiscal_year' })

  if (error) throw error
  
  const key = `${shuboNumber}-${fiscalYear}`
  setBrewingPreparation(prev => ({
    ...prev,
    [key]: data
  }))
}

// === shubo_discharge_schedule ===
async function loadDischargeSchedule() {
  const { data, error } = await supabase
    .from('shubo_discharge_schedule')
    .select('*')

  if (error && error.code !== 'PGRST116') {
    console.warn('卸し予定データ読み込みエラー:', error)
    return
  }

  const converted: Record<string, any> = {}
  
  ;(data || []).forEach((row: any) => {
    const key = `${row.shubo_number}-${row.fiscal_year}-${row.discharge_index}`
    converted[key] = {
      beforeDischargeKensyaku: row.before_discharge_kensyaku,
      afterDischargeCapacity: row.after_discharge_capacity,
      destinationTank: row.destination_tank || '',
      iceAmount: row.ice_amount
    }
  })

  setDischargeSchedule(converted)
}

async function saveDischargeSchedule(shuboNumber: number, fiscalYear: number, index: number, data: any) {
  const { error } = await supabase
    .from('shubo_discharge_schedule')
    .upsert({
      shubo_number: shuboNumber,
      fiscal_year: fiscalYear,
      discharge_index: index,
      before_discharge_kensyaku: data.beforeDischargeKensyaku,
      after_discharge_capacity: data.afterDischargeCapacity,
      destination_tank: data.destinationTank,
      ice_amount: data.iceAmount,
      updated_at: new Date().toISOString()
    }, { onConflict: 'shubo_number,fiscal_year,discharge_index' })

  if (error) throw error
  
  const key = `${shuboNumber}-${fiscalYear}-${index}`
  setDischargeSchedule(prev => ({
    ...prev,
    [key]: data
  }))
}

  // 年度フィルタリング済みデータ
  const filteredShuboRawData = useMemo(() => {
    return shuboRawData.filter(s => s.fiscalYear === currentFiscalYear)
  }, [shuboRawData, currentFiscalYear])

  const filteredConfiguredShuboData = useMemo(() => {
    return configuredShuboData.filter(s => s.fiscalYear === currentFiscalYear)
  }, [configuredShuboData, currentFiscalYear])

  const filteredDailyRecordsData = useMemo(() => {
    return dailyRecordsData.filter(r => r.fiscalYear === currentFiscalYear)
  }, [dailyRecordsData, currentFiscalYear])

  return {
  // データ
  shuboRawData,
  configuredShuboData,
  dailyRecordsData,
  recipeRawData,
  tankConfigData,
  tankConversionMap,
  analysisSettings,
  csvUpdateHistory,
  dailyEnvironment,
  brewingPreparation,
  dischargeSchedule,

  // フィルタ済みデータ
  filteredShuboRawData,
  filteredConfiguredShuboData,
  filteredDailyRecordsData,

  // 保存関数
  setShuboRawData: saveShuboRawData,
  setConfiguredShuboData: saveConfiguredShuboData,
  setDailyRecordsData: saveDailyRecordsData,
  setRecipeRawData: saveRecipeData,
  setTankConfigData: saveTankConfig,
  setAnalysisSettings: saveAnalysisSettings,
  saveDailyEnvironment,
  saveBrewingPreparation,
  saveDischargeSchedule,

  // 状態
  isLoading,
  loadError,
  currentFiscalYear,
  setCurrentFiscalYear,

  // リロード
  reloadData: loadAllData
}
}