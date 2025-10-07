import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { 
  ShuboRawData, 
  ConfiguredShuboData, 
  MergedShuboData, 
  DailyRecordData,
  RecipeRawData,
  TankConfigData,
  TankConversionRawData,
  CSVUpdateHistory,
  AnalysisSettings
} from '../utils/types'
import { calculateFiscalYear, createMergedShuboData } from '../utils/dataUtils'
import { DEFAULT_ANALYSIS_SETTINGS } from '../utils/types'

export function useData() {
  const [shuboRawData, setShuboRawDataState] = useState<ShuboRawData[]>([])
  const [configuredShuboData, setConfiguredShuboDataState] = useState<ConfiguredShuboData[]>([])
  const [dailyRecordsData, setDailyRecordsDataState] = useState<DailyRecordData[]>([])
  const [recipeRawData, setRecipeRawDataState] = useState<RecipeRawData[]>([])
  const [tankConfigData, setTankConfigDataState] = useState<TankConfigData[]>([])
  const [tankConversionMap, setTankConversionMap] = useState<Map<string, TankConversionRawData[]>>(new Map())
  const [mergedShuboData, setMergedShuboData] = useState<MergedShuboData[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings>(DEFAULT_ANALYSIS_SETTINGS)
  const [csvUpdateHistory, setCsvUpdateHistory] = useState<CSVUpdateHistory[]>([])
  const [currentFiscalYear, setCurrentFiscalYear] = useState<number>(() => calculateFiscalYear(new Date()))
const [dailyEnvironment, setDailyEnvironment] = useState<Record<string, { temperature: string; humidity: string }>>({})
  const [brewingPreparation, setBrewingPreparation] = useState<Record<string, any>>({})
  const [dischargeSchedule, setDischargeSchedule] = useState<Record<string, any>>({})

  // 初回データ読み込み + リアルタイム購読
  useEffect(() => {
    loadAllData()

    // リアルタイム購読
    const channel = supabase
      .channel('shubo_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shubo_raw_data' }, () => loadShuboRawData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shubo_configured_data' }, () => loadConfiguredShuboData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shubo_daily_records' }, () => loadDailyRecordsData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shubo_recipe_data' }, () => loadRecipeData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shubo_tank_config' }, () => loadTankConfig())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // configuredShuboData変更時にmergedShuboData再生成
  useEffect(() => {
    if (configuredShuboData.length > 0) {
      const merged = createMergedShuboData(configuredShuboData)
      setMergedShuboData(merged)
    }
  }, [configuredShuboData])

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
  loadDailyEnvironment(),
  loadBrewingPreparation(),
  loadDischargeSchedule(),
   loadAnalysisSettings(),
        loadCSVUpdateHistory()
])

    // データが空なら Supabase Storage からCSVインポート
  const needsImport = 
  shuboRawData.length === 0 || 
  recipeRawData.length === 0


    if (needsImport) {
      console.log('初回起動: Supabase StorageからCSVをインポートします')
      await importFromSupabaseStorage()
    }

  } catch (error) {
    console.error('データ読み込みエラー:', error)
    setLoadError(error instanceof Error ? error.message : 'データ読み込みに失敗しました')
  } finally {
    setIsLoading(false)
  }
}

// Supabase Storage からCSVインポート
// Supabase Storage からCSVインポート
// Supabase Storage からCSVインポート
async function importFromSupabaseStorage() {
  try {
    const { parseShuboCSV, parseRecipeCSV, loadCSV, parseTankConversionCSV } = await import('../utils/dataUtils')

    // shubo.csv
    if (shuboRawData.length === 0) {
      console.log('shubo.csv を読み込み中...')
      const { data: csvData } = await supabase.storage.from('csv-data').download('shubo.csv')
      if (csvData) {
        const text = await csvData.text()
        const lines = text.split('\n').filter(line => line.trim()).map(line => line.split(','))
        const parsed = parseShuboCSV(lines)
        if (parsed.length > 0) {
          await saveShuboRawData(parsed)
          console.log(`✓ shubo.csv: ${parsed.length}件インポート完了`)
        }
      }
    }

    // shubo_sikomi.csv
    if (recipeRawData.length === 0) {
      console.log('shubo_sikomi.csv を読み込み中...')
      const { data: csvData } = await supabase.storage.from('csv-data').download('shubo_sikomi.csv')
      if (csvData) {
        const text = await csvData.text()
        const lines = text.split('\n').filter(line => line.trim()).map(line => line.split(','))
        const parsed = parseRecipeCSV(lines)
        if (parsed.length > 0) {
          await saveRecipeData(parsed)
          console.log(`✓ shubo_sikomi.csv: ${parsed.length}件インポート完了`)
        }
      }
    }

    // タンク設定初期化
    if (tankConfigData.length === 0) {
      console.log('タンク設定を初期化中...')
      
      // ローカルからタンク変換データを読み込み
      const tankCSV = await loadCSV('/data/tank_quick_reference.csv')
      const parsedMap = parseTankConversionCSV(tankCSV)
      console.log(`タンク変換データ読み込み完了: ${parsedMap.size}タンク`)
      
      if (parsedMap.size > 0) {
        const { RECOMMENDED_SHUBO_TANKS } = await import('../utils/types')
        const tankConfigs: TankConfigData[] = []
        
        parsedMap.forEach((conversions, tankId) => {
          if (conversions.length === 0) return
          const maxCapacityData = conversions.find(conv => conv.kensyaku === 0)
          const maxCapacity = maxCapacityData?.capacity || 0
          const isRecommended = RECOMMENDED_SHUBO_TANKS.includes(tankId as any)
          tankConfigs.push({
            tankId, 
            displayName: `${tankId} (${maxCapacity}L)`, 
            maxCapacity,
            isEnabled: isRecommended, 
            isRecommended, 
            currentStatus: '空き', 
            availableDate: null, 
            memo: ''
          })
        })

        tankConfigs.sort((a, b) => b.maxCapacity - a.maxCapacity)
        if (tankConfigs.length > 0) {
          await saveTankConfig(tankConfigs)
          console.log(`✓ タンク設定: ${tankConfigs.length}件初期化完了`)
        }
      }
    }

    await Promise.all([loadShuboRawData(), loadRecipeData(), loadTankConfig()])
    console.log('✓ 全CSVインポート完了')

  } catch (error) {
    console.error('CSVインポートエラー:', error)
    throw error
  }
}

  async function loadShuboRawData() {
    const { data, error } = await supabase.from('shubo_raw_data').select('*').order('shubo_number')
    if (error) throw error
    setShuboRawDataState((data || []).map((r: any) => ({
      shuboNumber: r.shubo_number, fiscalYear: r.fiscal_year, brewingScale: r.brewing_scale,
      pourDate: r.pour_date || '', brewingCategory: r.brewing_category || '', tankNumber: r.tank_number || 0,
      memo: r.memo || '', kojiRiceVariety: r.koji_rice_variety || '', kakeRiceVariety: r.kake_rice_variety || '',
      shuboTotalRice: r.shubo_total_rice || 0, shuboStartDate: r.shubo_start_date || '', shuboEndDate: r.shubo_end_date || '',
      shuboDays: r.shubo_days || 0, yeast: r.yeast || ''
    })))
  }

  async function saveShuboRawData(data: ShuboRawData[]) {
    const { error } = await supabase.from('shubo_raw_data').upsert(data.map(s => ({
      shubo_number: s.shuboNumber, fiscal_year: s.fiscalYear, brewing_scale: s.brewingScale,
      pour_date: s.pourDate, brewing_category: s.brewingCategory, tank_number: s.tankNumber,
      memo: s.memo, koji_rice_variety: s.kojiRiceVariety, kake_rice_variety: s.kakeRiceVariety,
      shubo_total_rice: s.shuboTotalRice, shubo_start_date: s.shuboStartDate, shubo_end_date: s.shuboEndDate,
      shubo_days: s.shuboDays, yeast: s.yeast, updated_at: new Date().toISOString()
    })), { onConflict: 'shubo_number,fiscal_year' })
    if (error) throw error
    setShuboRawDataState(data)
  }

  async function loadConfiguredShuboData() {
    const { data, error } = await supabase.from('shubo_configured_data').select('*').order('shubo_number')
    if (error) throw error
    setConfiguredShuboDataState((data || []).map((r: any) => ({
      shuboNumber: r.shubo_number, fiscalYear: r.fiscal_year, selectedTankId: r.selected_tank_id || '',
      shuboType: r.shubo_type || '', shuboStartDate: new Date(r.shubo_start_date || Date.now()),
      shuboEndDate: new Date(r.shubo_end_date || Date.now()), shuboDays: r.shubo_days || 0,
      displayName: r.display_name || '', recipeData: r.recipe_data || {}, originalData: r.original_data || {},
      tankData: { tankDisplayName: '', maxCapacity: 0, waterKensyaku: 0, waterCapacity: 0 },
      dualShuboInfo: { isDualShubo: false, isPrimary: false, primaryNumber: r.shubo_number, combinedDisplayName: '' }
    })))
  }

  async function saveConfiguredShuboData(data: ConfiguredShuboData[]) {
    const { error } = await supabase.from('shubo_configured_data').upsert(data.map(s => ({
      shubo_number: s.shuboNumber, fiscal_year: s.fiscalYear, selected_tank_id: s.selectedTankId,
      shubo_type: s.shuboType, shubo_start_date: s.shuboStartDate.toISOString(), shubo_end_date: s.shuboEndDate.toISOString(),
      shubo_days: s.shuboDays, display_name: s.displayName, recipe_data: s.recipeData,
      original_data: s.originalData, updated_at: new Date().toISOString()
    })), { onConflict: 'shubo_number,fiscal_year' })
    if (error) throw error
    setConfiguredShuboDataState(data)
  }

  async function loadDailyRecordsData() {
    const { data, error } = await supabase.from('shubo_daily_records').select('*').order('record_date')
    if (error) throw error
    setDailyRecordsDataState((data || []).map((r: any) => ({
      shuboNumber: r.shubo_number, fiscalYear: r.fiscal_year, recordDate: new Date(r.record_date),
      dayNumber: r.day_number || 0, dayLabel: r.day_label || '', timeSlot: r.time_slot || '',
      temperature: r.temperature, temperature1: r.temperature1, temperature2: r.temperature2, temperature3: r.temperature3,
      temperatureAfterHeating: r.temperature_after_heating, baume: r.baume, acidity: r.acidity, alcohol: r.alcohol,
      memo: r.memo || '', isAnalysisDay: r.is_analysis_day || false
    })))
  }

  async function saveDailyRecordsData(data: DailyRecordData[]) {
    const { error } = await supabase.from('shubo_daily_records').upsert(data.map(r => ({
      shubo_number: r.shuboNumber, fiscal_year: r.fiscalYear, record_date: r.recordDate.toISOString().split('T')[0],
      day_number: r.dayNumber, day_label: r.dayLabel, time_slot: r.timeSlot, temperature: r.temperature,
      temperature1: r.temperature1, temperature2: r.temperature2, temperature3: r.temperature3,
      temperature_after_heating: r.temperatureAfterHeating, baume: r.baume, acidity: r.acidity, alcohol: r.alcohol,
      memo: r.memo, is_analysis_day: r.isAnalysisDay, updated_at: new Date().toISOString()
    })), { onConflict: 'shubo_number,fiscal_year,record_date,time_slot' })
    if (error) throw error
    setDailyRecordsDataState(data)
  }

  async function loadRecipeData() {
    const { data, error } = await supabase.from('shubo_recipe_data').select('*')
    if (error) throw error
    setRecipeRawDataState((data || []).map((r: any) => ({
      shuboType: r.shubo_type, recipeBrewingScale: r.recipe_brewing_scale, recipeTotalRice: r.recipe_total_rice,
      steamedRice: r.steamed_rice, kojiRice: r.koji_rice, water: r.water, measurement: r.measurement, lacticAcid: r.lactic_acid,
      初添_総米: r['初添_総米'], 初添_掛米: r['初添_掛米'], 初添_麹米: r['初添_麹米'], 初添_汲み水: r['初添_汲み水'],
      仲添_総米: r['仲添_総米'], 仲添_掛米: r['仲添_掛米'], 仲添_麹米: r['仲添_麹米'], 仲添_汲み水: r['仲添_汲み水'],
      留添_総米: r['留添_総米'], 留添_掛米: r['留添_掛米'], 留添_麹米: r['留添_麹米'], 留添_汲み水: r['留添_汲み水'],
      三段総米: r['三段総米'], 留までの汲水歩合: r['留までの汲水歩合']
    })))
  }

  async function saveRecipeData(data: RecipeRawData[]) {
    const { error } = await supabase.from('shubo_recipe_data').upsert(data.map(r => ({
      shubo_type: r.shuboType, recipe_brewing_scale: r.recipeBrewingScale, recipe_total_rice: r.recipeTotalRice,
      steamed_rice: r.steamedRice, koji_rice: r.kojiRice, water: r.water, measurement: r.measurement, lactic_acid: r.lacticAcid,
      '初添_総米': r.初添_総米, '初添_掛米': r.初添_掛米, '初添_麹米': r.初添_麹米, '初添_汲み水': r.初添_汲み水,
      '仲添_総米': r.仲添_総米, '仲添_掛米': r.仲添_掛米, '仲添_麹米': r.仲添_麹米, '仲添_汲み水': r.仲添_汲み水,
      '留添_総米': r.留添_総米, '留添_掛米': r.留添_掛米, '留添_麹米': r.留添_麹米, '留添_汲み水': r.留添_汲み水,
      '三段総米': r.三段総米, '留までの汲水歩合': r.留までの汲水歩合, updated_at: new Date().toISOString()
    })), { onConflict: 'shubo_type,recipe_brewing_scale' })
    if (error) throw error
    setRecipeRawDataState(data)
  }

  async function loadTankConfig() {
    const { data, error } = await supabase.from('shubo_tank_config').select('*')
    if (error) throw error
    setTankConfigDataState((data || []).map((r: any) => ({
      tankId: r.tank_id, displayName: r.display_name, maxCapacity: r.max_capacity,
      isEnabled: r.is_enabled, isRecommended: r.is_recommended, currentStatus: r.current_status || '空き',
      availableDate: r.available_date ? new Date(r.available_date) : null, memo: r.memo || ''
    })))
  }

async function saveTankConfig(data: TankConfigData[]) {
    const { error } = await supabase.from('shubo_tank_config').upsert(data.map(t => ({
      tank_id: t.tankId, display_name: t.displayName, max_capacity: t.maxCapacity, is_enabled: t.isEnabled,
      is_recommended: t.isRecommended, current_status: t.currentStatus,
      available_date: t.availableDate?.toISOString().split('T')[0], memo: t.memo, updated_at: new Date().toISOString()
    })), { onConflict: 'tank_id' })
    if (error) throw error
    setTankConfigDataState(data)
  }

async function loadTankConversion() {
  const { loadCSV, parseTankConversionCSV } = await import('../utils/dataUtils')
  const tankCSV = await loadCSV('/data/tank_quick_reference.csv')
  const parsedMap = parseTankConversionCSV(tankCSV)
  setTankConversionMap(parsedMap)
}
// === shubo_daily_environment ===
async function loadDailyEnvironment() {
  const { data, error } = await supabase
    .from('shubo_daily_environment')
    .select('*')
    .order('date', { ascending: true })

  if (error && error.code !== 'PGRST116') throw error

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

  if (error && error.code !== 'PGRST116') throw error

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

  if (error && error.code !== 'PGRST116') throw error

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
async function loadAnalysisSettings() {
    try {
      const { data, error } = await supabase
        .from('shubo_analysis_settings')
        .select('*')
        .single()
      
      if (error) {
        console.log('分析設定が見つかりません。デフォルト値を使用します')
        return
      }
      
      if (data) {
        setAnalysisSettings(data.settings)
      }
    } catch (error) {
      console.error('分析設定読み込みエラー:', error)
    }
  }

  async function loadCSVUpdateHistory() {
    try {
      const { data, error } = await supabase
        .from('shubo_csv_update_history')
        .select('*')
        .order('executed_at', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        const histories = data.map(d => ({
          updateDate: new Date(d.update_date),
          executedAt: new Date(d.executed_at),
          updatedCount: d.updated_count,
          keptCount: d.kept_count
        }))
        setCsvUpdateHistory(histories)
      }
    } catch (error) {
      console.error('CSV更新履歴読み込みエラー:', error)
    }
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

async function saveAnalysisSettings(settings: AnalysisSettings) {
    try {
      const { error } = await supabase
        .from('shubo_analysis_settings')
        .upsert({ id: 1, settings }, { onConflict: 'id' })
      
      if (error) throw error
      setAnalysisSettings(settings)
    } catch (error) {
      console.error('分析設定保存エラー:', error)
      throw error
    }
  }

  async function saveCSVUpdateHistory(history: CSVUpdateHistory) {
    try {
      const { error } = await supabase
        .from('shubo_csv_update_history')
        .insert({
          update_date: history.updateDate.toISOString(),
          executed_at: history.executedAt.toISOString(),
          updated_count: history.updatedCount,
          kept_count: history.keptCount
        })
      
      if (error) throw error
      
      setCsvUpdateHistory(prev => [history, ...prev])
    } catch (error) {
      console.error('CSV更新履歴保存エラー:', error)
      throw error
    }
  }

  async function bulkUpdateDailyRecords(records: DailyRecordData[]) {
    try {
      const updates = records.map(record => ({
        shubo_number: record.shuboNumber,
        fiscal_year: record.fiscalYear,
        day_number: record.dayNumber,
        record_date: record.recordDate.toISOString().split('T')[0],
        temperature1: record.temperature1,
        temperature2: record.temperature2,
        temperature3: record.temperature3,
        baume: record.baume,
        acidity: record.acidity,
        memo: record.memo
      }))

      const { error } = await supabase
        .from('shubo_daily_records')
        .upsert(updates, {
          onConflict: 'shubo_number,fiscal_year,day_number'
        })
      
      if (error) throw error
      
      await loadDailyRecordsData()
    } catch (error) {
      console.error('日別記録一括更新エラー:', error)
      throw error
    }
  }

  async function deleteBrewingPreparationByShuboKeys(keys: string[]) {
    try {
      for (const key of keys) {
        const parts = key.split('-')
        const shuboNumber = parseInt(parts[0])
        const fiscalYear = parseInt(parts[1])
        
        const { error } = await supabase
          .from('shubo_brewing_preparation')
          .delete()
          .eq('shubo_number', shuboNumber)
          .eq('fiscal_year', fiscalYear)
        
        if (error) throw error
      }
      
      await loadBrewingPreparation()
    } catch (error) {
      console.error('仕込み準備削除エラー:', error)
      throw error
    }
  }

  async function deleteDischargeScheduleByShuboKeys(keys: string[]) {
    try {
      for (const key of keys) {
        const parts = key.split('-')
        const shuboNumber = parseInt(parts[0])
        const fiscalYear = parseInt(parts[1])
        
        const { error } = await supabase
          .from('shubo_discharge_schedule')
          .delete()
          .eq('shubo_number', shuboNumber)
          .eq('fiscal_year', fiscalYear)
        
        if (error) throw error
      }
      
      await loadDischargeSchedule()
    } catch (error) {
      console.error('卸し予定削除エラー:', error)
      throw error
    }
  }

  async function importAllData(data: {
    shuboRawData: ShuboRawData[]
    recipeRawData: RecipeRawData[]
    configuredShuboData: ConfiguredShuboData[]
    dailyRecordsData: DailyRecordData[]
    tankConfigData: TankConfigData[]
    analysisSettings: AnalysisSettings
    csvUpdateHistory: CSVUpdateHistory[]
    dailyEnvironment: Record<string, { temperature: string; humidity: string }>
    brewingPreparation: Record<string, any>
    dischargeSchedule: Record<string, any>
  }) {
    try {
      await saveShuboRawData(data.shuboRawData)
      await saveRecipeData(data.recipeRawData)
      
      for (const config of data.configuredShuboData) {
        await saveConfiguredShubo(config)
      }
      
      await bulkUpdateDailyRecords(data.dailyRecordsData)
      
      await saveTankConfig(data.tankConfigData)
    
    await saveAnalysisSettings(data.analysisSettings)
    
    for (const history of data.csvUpdateHistory) {
      await saveCSVUpdateHistory(history)
    }
    
    for (const [dateKey, env] of Object.entries(data.dailyEnvironment)) {
      await saveDailyEnvironment(dateKey, env.temperature, env.humidity)
    }
    
    for (const [key, prep] of Object.entries(data.brewingPreparation)) {
      const parts = key.split('-')
      await saveBrewingPreparation(parseInt(parts[0]), parseInt(parts[1]), prep)
    }
    
    for (const [key, discharge] of Object.entries(data.dischargeSchedule)) {
      const parts = key.split('-')
      await saveDischargeSchedule(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), discharge)
    }
    
    await loadAllData()
  } catch (error) {
    console.error('データインポートエラー:', error)
    throw error
  }
}


  const availableFiscalYears = useMemo(() => {
    const years = new Set<number>()
    shuboRawData.forEach(s => years.add(s.fiscalYear))
    return Array.from(years).sort((a, b) => b - a)
  }, [shuboRawData])

  const filteredConfiguredShuboData = useMemo(() => 
    configuredShuboData.filter(s => s.fiscalYear === currentFiscalYear), 
    [configuredShuboData, currentFiscalYear]
  )

  const filteredMergedShuboData = useMemo(() => 
    mergedShuboData.filter(s => s.fiscalYear === currentFiscalYear),
    [mergedShuboData, currentFiscalYear]
  )

  const filteredDailyRecordsData = useMemo(() =>
    dailyRecordsData.filter(r => r.fiscalYear === currentFiscalYear),
    [dailyRecordsData, currentFiscalYear]
  )

  function getTankConversions(tankId: string) {
    return tankConversionMap.get(tankId) || []
  }

  function getEnabledTanks() {
    return tankConfigData.filter(t => t.isEnabled)
  }

  function getRecommendedTanks() {
    return tankConfigData.filter(t => t.isRecommended)
  }

  function updateTankConfig(tankId: string, updates: Partial<TankConfigData>) {
    const updated = tankConfigData.map(t => t.tankId === tankId ? { ...t, ...updates } : t)
    saveTankConfig(updated)
  }

  function saveConfiguredShubo(data: ConfiguredShuboData) {
    const updated = [...configuredShuboData.filter(s => !(s.shuboNumber === data.shuboNumber && s.fiscalYear === data.fiscalYear)), data]
    saveConfiguredShuboData(updated)
  }

  function removeConfiguredShubo(shuboNumber: number, fiscalYear: number) {
    const updated = configuredShuboData.filter(s => !(s.shuboNumber === shuboNumber && s.fiscalYear === fiscalYear))
    saveConfiguredShuboData(updated)
  }

  function updateDailyRecord(record: DailyRecordData) {
    const updated = [...dailyRecordsData.filter(r => !(r.shuboNumber === record.shuboNumber && r.fiscalYear === record.fiscalYear && r.dayNumber === record.dayNumber)), record]
    saveDailyRecordsData(updated)
  }

  function getDailyRecords(shuboNumber: number, fiscalYear?: number) {
    const year = fiscalYear ?? currentFiscalYear
    return dailyRecordsData.filter(r => r.shuboNumber === shuboNumber && r.fiscalYear === year)
  }

  return {
  shuboRawData: shuboRawData.filter(s => s.fiscalYear === currentFiscalYear),
  setShuboRawData: saveShuboRawData, 
  recipeRawData, 
  setRecipeRawData: saveRecipeData,
  tankConversionMap, 
  configuredShuboData: filteredConfiguredShuboData,
  setConfiguredShuboData: saveConfiguredShuboData,
  mergedShuboData: filteredMergedShuboData,
  tankConfigData, 
  dailyRecordsData: filteredDailyRecordsData,
  dailyEnvironment,
  brewingPreparation,
  dischargeSchedule,
  saveDailyEnvironment,
  saveBrewingPreparation,
  saveDischargeSchedule,
  currentFiscalYear, 
  setCurrentFiscalYear,
  availableFiscalYears, 
  isLoading, 
  loadError, 
  getTankConversions, 
  getEnabledTanks, 
  getRecommendedTanks,
  updateTankConfig, 
  saveConfiguredShubo, 
  removeConfiguredShubo, 
  updateDailyRecord, 
  getDailyRecords,
  reloadData: loadAllData,
  analysisSettings,
    saveAnalysisSettings,
    csvUpdateHistory,
    saveCSVUpdateHistory,
    bulkUpdateDailyRecords,
    deleteBrewingPreparationByShuboKeys,
    deleteDischargeScheduleByShuboKeys,
    importAllData
  
}
}
