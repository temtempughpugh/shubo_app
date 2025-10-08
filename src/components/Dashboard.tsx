import { useState, useMemo, useRef } from 'react';
import type {
  ConfiguredShuboData,
  DailyRecordData,
  MergedShuboData
} from '../utils/types';
import { Fragment } from 'react';
import { createShuboKey } from '../utils/types';
import ShuboDetailExpansion from './ShuboDetailExpansion';
import { generateDailyRecords } from '../utils/dataUtils';

interface DashboardProps {
  dataContext: {
    shuboRawData: any[];
    recipeRawData: any[];
    tankConversionMap: Map<string, any[]>;
    tankConfigData: any[];
    configuredShuboData: ConfiguredShuboData[];
    mergedShuboData: MergedShuboData[];
    dailyRecordsData: DailyRecordData[];
    getDailyRecords: (shuboNumber: number, fiscalYear?: number) => DailyRecordData[];
    updateDailyRecord: (record: DailyRecordData) => void;
    currentFiscalYear: number;
    dailyEnvironment: Record<string, { temperature: string; humidity: string }>;
    brewingPreparation: Record<string, any>;
    dischargeSchedule: Record<string, any>;
    saveDailyEnvironment: (dateKey: string, temperature: string, humidity: string) => Promise<void>;
    saveBrewingPreparation: (shuboNumber: number, fiscalYear: number, data: any) => Promise<void>;
    saveDischargeSchedule: (shuboNumber: number, fiscalYear: number, index: number, data: any) => Promise<void>;
    analysisSettings: any;
  };
}


export default function Dashboard({ dataContext }: DashboardProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedShubo, setExpandedShubo] = useState<number | null>(null);
  const [scheduleStartDate, setScheduleStartDate] = useState<string>('');
const [scheduleEndDate, setScheduleEndDate] = useState<string>('');
   const dailyEnvironment = dataContext.dailyEnvironment || {};


  const brewingInput = dataContext.brewingPreparation || {};
  const dischargeInput = dataContext.dischargeSchedule || {};

const [localRecordUpdates, setLocalRecordUpdates] = useState<Map<string, Partial<DailyRecordData>>>(new Map());
  const [localBrewingUpdates, setLocalBrewingUpdates] = useState<Map<string, any>>(new Map());
  const [localDischargeUpdates, setLocalDischargeUpdates] = useState<Map<string, any>>(new Map());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const currentDateKey = getDateKey(currentDate);
  const currentEnv = dailyEnvironment[currentDateKey] || { temperature: '', humidity: '' };

  const formatDate = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return `${year}/${month}/${day}(${dayOfWeek})`;
  };

  const calculateDayNumber = (startDate: Date | string, currentDate: Date): number => {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const diffTime = currentDate.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  };

  const getStatusForMerged = (shubo: MergedShuboData): string => {
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    
    const startDate = shubo.shuboStartDate instanceof Date 
      ? new Date(shubo.shuboStartDate) 
      : new Date(shubo.shuboStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    const lastEndDate = shubo.shuboEndDates[shubo.shuboEndDates.length - 1];
    const endDate = lastEndDate instanceof Date 
      ? new Date(lastEndDate) 
      : new Date(lastEndDate);
    endDate.setHours(0, 0, 0, 0);

    if (today < startDate) return '準備中';
    if (today >= startDate && today <= endDate) return '管理中';
    return '完了';
  };

  const getKensyakuFromCapacity = (tankId: string, targetCapacity: number): number | null => {
    const tankConversions = dataContext.tankConversionMap.get(tankId);
    if (!tankConversions || tankConversions.length === 0) return null;
    
    let closestConversion = tankConversions[0];
    let minDiff = Math.abs(tankConversions[0].capacity - targetCapacity);
    
    for (const conv of tankConversions) {
      const diff = Math.abs(conv.capacity - targetCapacity);
      if (diff < minDiff) {
        minDiff = diff;
        closestConversion = conv;
      }
      if (conv.capacity >= targetCapacity && closestConversion.capacity < targetCapacity) {
        break;
      }
    }
    
    return closestConversion.kensyaku;
  };

  const getCapacityFromKensyaku = (tankId: string, kensyaku: number): number | null => {
    const tankConversions = dataContext.tankConversionMap.get(tankId);
    if (!tankConversions) return null;
    
    const match = tankConversions.find(conv => conv.kensyaku === kensyaku);
    return match ? match.capacity : null;
  };

  const handleShuboClick = (shuboNumber: number) => {
    setExpandedShubo(expandedShubo === shuboNumber ? null : shuboNumber);
  };

  const getShuboRecords = (shubo: MergedShuboData): DailyRecordData[] => {
    const existing = dataContext.getDailyRecords(shubo.primaryNumber);
    
    if (existing.length > 0) {
      return existing;
    }
    
    const records = generateDailyRecords(shubo);
    records.forEach(record => {
      dataContext.updateDailyRecord(record);
    });
    
    return dataContext.getDailyRecords(shubo.primaryNumber);
  };

  const handleUpdateRecord = (record: DailyRecordData) => {
    dataContext.updateDailyRecord(record);
  };

  const getTodayAnalysisRecord = (shuboNumber: number, dayNumber: number): DailyRecordData | null => {
    const records = dataContext.getDailyRecords(shuboNumber);
    return records.find(r => r.dayNumber === dayNumber) || null;
  };

  const getDay1Record = (shuboNumber: number): DailyRecordData | null => {
    const records = dataContext.getDailyRecords(shuboNumber);
    return records.find(r => r.dayNumber === 1) || null;
  };

  const updateAnalysisRecord = (shuboNumber: number, dayNumber: number, updates: Partial<DailyRecordData>) => {
    const record = getTodayAnalysisRecord(shuboNumber, dayNumber);
    if (!record) return;

    const key = `analysis-${shuboNumber}-${record.fiscalYear}-${dayNumber}`;
    
    setLocalRecordUpdates(prev => {
      const newMap = new Map(prev);
      const existing = prev.get(key) || {};
      newMap.set(key, { ...existing, ...updates });
      return newMap;
    });

    const existingTimer = debounceTimers.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const newTimer = setTimeout(() => {
      const mergedUpdates = localRecordUpdates.get(key) || {};
      dataContext.updateDailyRecord({ ...record, ...mergedUpdates, ...updates });
      

      debounceTimers.current.delete(key);
    }, 1500);

    debounceTimers.current.set(key, newTimer);
  };

  const updateBrewingRecord = (shuboNumber: number, updates: Partial<DailyRecordData>) => {
    const record = getDay1Record(shuboNumber);
    if (!record) return;

    const key = `brewing-${shuboNumber}-${record.fiscalYear}-1`;
    
    setLocalRecordUpdates(prev => {
      const newMap = new Map(prev);
      const existing = prev.get(key) || {};
      newMap.set(key, { ...existing, ...updates });
      return newMap;
    });

    const existingTimer = debounceTimers.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const newTimer = setTimeout(() => {
      const mergedUpdates = localRecordUpdates.get(key) || {};
      dataContext.updateDailyRecord({ ...record, ...mergedUpdates, ...updates });
      

      debounceTimers.current.delete(key);
    }, 1500);

    debounceTimers.current.set(key, newTimer);
  };

  const getDisplayRecordValue = (shuboNumber: number, dayNumber: number, field: keyof DailyRecordData): string | number => {
    const record = dayNumber === 1 ? getDay1Record(shuboNumber) : getTodayAnalysisRecord(shuboNumber, dayNumber);
    if (!record) return '';
    
    const key = dayNumber === 1 ? `brewing-${shuboNumber}-${record.fiscalYear}-1` : `analysis-${shuboNumber}-${record.fiscalYear}-${dayNumber}`;
    const localUpdate = localRecordUpdates.get(key);
    
    if (localUpdate && field in localUpdate) {
      const value = localUpdate[field];
      if (typeof value === 'string' || typeof value === 'number') {
        return value ?? '';
      }
      return '';
    }
    
    const value = record[field];
    if (typeof value === 'string' || typeof value === 'number') {
      return value ?? '';
    }
    return '';
  };

  const getDisplayBrewingValue = (shuboNumber: number, fiscalYear: number, field: 'iceAmount' | 'afterBrewingKensyaku'): string | number => {
    const key = `${shuboNumber}-${fiscalYear}`;
    const localUpdate = localBrewingUpdates.get(key);
    
    if (localUpdate && field in localUpdate) {
      return localUpdate[field] ?? '';
    }
    
    return brewingInput[key]?.[field] ?? '';
  };

  const getDisplayDischargeValue = (shuboNumber: number, fiscalYear: number, index: number, field: string): string | number => {
    const key = `${shuboNumber}-${fiscalYear}-${index}`;
    const localUpdate = localDischargeUpdates.get(key);
    
    if (localUpdate && field in localUpdate) {
      return localUpdate[field] ?? '';
    }
    
    return dischargeInput[key]?.[field] ?? '';
  };

  const updateBrewingInput = async (shuboNumber: number, fiscalYear: number, field: 'iceAmount' | 'afterBrewingKensyaku', value: number | null) => {
    const key = `${shuboNumber}-${fiscalYear}`;
    
    setLocalBrewingUpdates(prev => {
      const newMap = new Map(prev);
      const existing = prev.get(key) || {};
      newMap.set(key, { ...existing, [field]: value });
      return newMap;
    });

    const timerKey = `brewing-prep-${key}`;
    const existingTimer = debounceTimers.current.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    const newTimer = setTimeout(async () => {
      const mergedUpdates = localBrewingUpdates.get(key) || {};
      await dataContext.saveBrewingPreparation(
        shuboNumber,
        fiscalYear,
        {
          ...brewingInput[key],
          ...mergedUpdates,
          [field]: value
        }
      );
      
      debounceTimers.current.delete(timerKey);
    }, 1500);

    debounceTimers.current.set(timerKey, newTimer);
  };

  const updateDischargeInput = async (shuboNumber: number, fiscalYear: number, index: number, field: string, value: any) => {
    const key = `${shuboNumber}-${fiscalYear}-${index}`;
    
    setLocalDischargeUpdates(prev => {
      const newMap = new Map(prev);
      const existing = prev.get(key) || {};
      newMap.set(key, { ...existing, [field]: value });
      return newMap;
    });

    const timerKey = `discharge-${key}`;
    const existingTimer = debounceTimers.current.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    const newTimer = setTimeout(async () => {
      const mergedUpdates = localDischargeUpdates.get(key) || {};
      await dataContext.saveDischargeSchedule(
        shuboNumber,
        fiscalYear,
        index,
        {
          ...dischargeInput[key],
          ...mergedUpdates,
          [field]: value
        }
      );
      
      setLocalDischargeUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      debounceTimers.current.delete(timerKey);
    }, 500);

    debounceTimers.current.set(timerKey, newTimer);
  };

  const todayWorks = useMemo(() => {
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);

    const preparations = dataContext.mergedShuboData.filter(shubo => {
      const startDate = shubo.shuboStartDate instanceof Date 
        ? new Date(shubo.shuboStartDate) 
        : new Date(shubo.shuboStartDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === tomorrow.getTime();
    });

    const brewingSchedules = dataContext.mergedShuboData.filter(shubo => {
      const startDate = shubo.shuboStartDate instanceof Date 
        ? new Date(shubo.shuboStartDate) 
        : new Date(shubo.shuboStartDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === today.getTime();
    });

    const analysisSchedules = dataContext.mergedShuboData.filter(shubo => {
      const status = getStatusForMerged(shubo);
      if (status !== '管理中') return false;
      
      const dayNum = calculateDayNumber(shubo.shuboStartDate, currentDate);
      if (dayNum > 1) {
        const existing = dataContext.getDailyRecords(shubo.primaryNumber);
        if (existing.length === 0) {
          const records = generateDailyRecords(shubo);
          records.forEach(record => {
            dataContext.updateDailyRecord(record);
          });
        }
        return true;
      }
      return false;
    });

    const dischargeSchedules = dataContext.mergedShuboData.filter(shubo => {
      return shubo.shuboEndDates.some(endDate => {
        const date = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === today.getTime();
      });
    });

    return {
      preparations,
      brewingSchedules,
      analysisSchedules,
      dischargeSchedules
    };
  }, [currentDate, dataContext.mergedShuboData]);

  const shuboList = useMemo(() => {
    type ShuboStatus = '管理中' | '準備中' | '完了';
    
    const list = dataContext.mergedShuboData.map(shubo => {
      const status = getStatusForMerged(shubo) as ShuboStatus;
      
      const startDate = shubo.shuboStartDate instanceof Date 
        ? shubo.shuboStartDate 
        : new Date(shubo.shuboStartDate);
      const lastEndDate = shubo.shuboEndDates[shubo.shuboEndDates.length - 1];
      const endDate = lastEndDate instanceof Date 
        ? lastEndDate 
        : new Date(lastEndDate);
      
      const diffTime = endDate.getTime() - startDate.getTime();
      const period = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        ...shubo,
        status,
        dayNumber: status === '管理中' 
          ? calculateDayNumber(shubo.shuboStartDate, currentDate)
          : null,
        period
      };
    });

    return list.sort((a, b) => {
      const statusOrder: Record<ShuboStatus, number> = { '管理中': 1, '準備中': 2, '完了': 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [dataContext.mergedShuboData, currentDate]);


  const handleScheduleExport = () => {
  if (!scheduleStartDate || !scheduleEndDate) {
    alert('開始日と終了日を選択してください');
    return;
  }

  const start = new Date(scheduleStartDate);
  const end = new Date(scheduleEndDate);
  
  if (start > end) {
    alert('開始日は終了日より前の日付を選択してください');
    return;
  }

  const html = generateScheduleHTML(start, end);
  
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = `${scheduleStartDate}_${scheduleEndDate}`.replace(/-/g, '');
  a.href = url;
  a.download = `酒母予定表_${dateStr}.html`;
  a.click();
  URL.revokeObjectURL(url);

  alert('予定表を出力しました');
};

const generateScheduleHTML = (startDate: Date, endDate: Date): string => {
  const days: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const formatDateHeader = (date: Date): string => {
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = weekDays[date.getDay()];
    return `${year}/${month}/${day}（${weekDay}）`;
  };

  const getDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getDayWorks = (date: Date) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    const preparations = dataContext.mergedShuboData.filter(shubo => {
      const startDate = shubo.shuboStartDate instanceof Date 
        ? new Date(shubo.shuboStartDate) 
        : new Date(shubo.shuboStartDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === tomorrow.getTime();
    });

    const brewingSchedules = dataContext.mergedShuboData.filter(shubo => {
      const startDate = shubo.shuboStartDate instanceof Date 
        ? new Date(shubo.shuboStartDate) 
        : new Date(shubo.shuboStartDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === today.getTime();
    });

    const analysisSchedules = dataContext.mergedShuboData.filter(shubo => {
      const status = getStatusForMerged(shubo);
      if (status !== '管理中') return false;
      
      const dayNum = calculateDayNumber(shubo.shuboStartDate, date);
      return dayNum > 1;
    });

    const dischargeSchedules = dataContext.mergedShuboData.filter(shubo => {
      return shubo.shuboEndDates.some(endDate => {
        const d = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
    });

    return { preparations, brewingSchedules, analysisSchedules, dischargeSchedules };
  };

  let pagesHTML = '';
  
  for (let i = 0; i < days.length; i += 4) {
    const pageDays = days.slice(i, i + 4);
    
    let daysSectionsHTML = pageDays.map(day => {
      const dateKey = getDateKey(day);
      const env = dailyEnvironment[dateKey] || { temperature: '', humidity: '' };
      const works = getDayWorks(day);

      // 仕込み準備HTML
     let prepHTML = '';
      if (works.preparations.length > 0) {
        prepHTML = `<table>
          <tr>
            <th>酒母</th>
            <th>タンク</th>
            <th>酵母</th>
            <th>汲み水</th>
            <th>氷量</th>
            <th>準備水</th>
            <th>尺</th>
            <th>乳酸</th>
          </tr>
          ${works.preparations.map(shubo => {
            const waterAmount = shubo.recipeData.water;
            const lacticAcidAmount = shubo.recipeData.lacticAcid;
            return `<tr>
              <td>${shubo.displayName}</td>
              <td>${shubo.selectedTankId}</td>
              <td>${shubo.originalData[0]?.yeast || '-'}</td>
              <td>${waterAmount}L</td>
              <td></td>
              <td></td>
              <td></td>
              <td>${lacticAcidAmount}ml</td>
            </tr>`;
          }).join('')}
        </table>`;
      }

      // 仕込み予定HTML
      let brewingHTML = '';
      if (works.brewingSchedules.length === 0) {
        brewingHTML = '<div class="no-data">予定なし</div>';
      } else {
        brewingHTML = `<table>
          <tr>
            <th>酒母</th>
            <th>タンク</th>
            <th>水麹温度</th>
            <th>仕込温度</th>
            <th>留測予定</th>
            <th>留測尺</th>
            <th>留測</th>
            <th>留測歩合</th>
          </tr>
          ${works.brewingSchedules.map(shubo => {
            const expectedMeasurement = shubo.recipeData.measurement;
            return `<tr>
              <td>${shubo.displayName}</td>
              <td>${shubo.selectedTankId}</td>
              <td></td>
              <td></td>
              <td>${expectedMeasurement}L</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`;
          }).join('')}
        </table>`;
      }

      // 分析予定HTML
      let analysisHTML = '';
      if (works.analysisSchedules.length > 0) {
        const halfLength = Math.ceil(works.analysisSchedules.length / 2);
        const leftColumn = works.analysisSchedules.slice(0, halfLength);
        const rightColumn = works.analysisSchedules.slice(halfLength);
        
        analysisHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2mm;">
          <table>
          <tr>
            <th style="width: 8%;">採取</th>
            <th style="width: 20%;">酒母名</th>
            <th style="width: 15%;">日数</th>
            <th style="width: 15%;">ラベル</th>
            <th>品温</th>
            <th>ボーメ</th>
            <th>酸度</th>
          </tr>
          ${leftColumn.map(shubo => {
            const dayNum = calculateDayNumber(shubo.shuboStartDate, day);
            const isSaishushu = dayNum === 2 || dayNum === shubo.maxShuboDays;
            const saishu = isSaishushu ? '○' : '';
            
            let label = '';
            if (dayNum === 1) label = '仕込み';
            else if (dayNum === 2) label = '打瀬';
            else if (dayNum === shubo.maxShuboDays) label = '卸し';
            
            return `<tr>
              <td style="text-align: center;">${saishu}</td>
              <td>${shubo.displayName}</td>
              <td>${dayNum}日目</td>
              <td>${label}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`;
          }).join('')}
        </table>
        ${rightColumn.length > 0 ? `<table>
          <tr>
            <th style="width: 8%;">採取</th>
            <th style="width: 20%;">酒母名</th>
            <th style="width: 15%;">日数</th>
            <th style="width: 15%;">ラベル</th>
            <th>品温</th>
            <th>ボーメ</th>
            <th>酸度</th>
          </tr>
          ${rightColumn.map(shubo => {
            const dayNum = calculateDayNumber(shubo.shuboStartDate, day);
            const isSaishushu = dayNum === 2 || dayNum === shubo.maxShuboDays;
            const saishu = isSaishushu ? '○' : '';
            
            let label = '';
            if (dayNum === 1) label = '仕込み';
            else if (dayNum === 2) label = '打瀬';
            else if (dayNum === shubo.maxShuboDays) label = '卸し';
            
            return `<tr>
              <td style="text-align: center;">${saishu}</td>
              <td>${shubo.displayName}</td>
              <td>${dayNum}日目</td>
              <td>${label}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`;
          }).join('')}
        </table>` : ''}
        </div>`;
      }

      // 卸し予定HTML
      let dischargeHTML = '';
      if (works.dischargeSchedules.length === 0) {
        dischargeHTML = '<div class="no-data">予定なし</div>';
      } else {
        dischargeHTML = `<table>
          <tr>
            <th>酒母名</th>
            <th>タンク</th>
            <th>卸前尺</th>
            <th>卸前容量</th>
            <th>卸後容量</th>
            <th>卸し量</th>
            <th>添汲み水</th>
          </tr>
          ${works.dischargeSchedules.map(shubo => {
            return `<tr>
              <td>${shubo.displayName}</td>
              <td>${shubo.selectedTankId}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`;
          }).join('')}
        </table>`;
      }

      return `
        <div class="day-section">
          <div class="day-header">
            <h2>📅 ${formatDateHeader(day)}</h2>
            ${env.temperature || env.humidity ? `<div class="env-info">気温: ${env.temperature || '-'} / 湿度: ${env.humidity || '-'}</div>` : ''}
          </div>

          ${prepHTML ? `<div class="work-block">
            <div class="work-block-title prep">🧪 仕込み準備（明日）</div>
            ${prepHTML}
          </div>` : ''}

          ${brewingHTML ? `<div class="work-block">
            <div class="work-block-title brewing">🌾 仕込み予定（本日）</div>
            ${brewingHTML}
          </div>` : ''}

          ${analysisHTML ? `<div class="work-block">
            <div class="work-block-title analysis">🔬 分析予定</div>
            ${analysisHTML}
          </div>` : ''}

          ${dischargeHTML ? `<div class="work-block">
            <div class="work-block-title discharge">📤 卸し予定</div>
            ${dischargeHTML}
          </div>` : ''}
        </div>
      `;
    }).join('');

    pagesHTML += `<div class="page">${daysSectionsHTML}</div>`;
  }

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>酒母予定表</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Yu Gothic', 'Meiryo', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 5mm;
      background: white;
      page-break-after: always;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .day-section {
      height: 68mm;
      margin-bottom: 2mm;
      border: 1px solid #cbd5e1;
      padding: 2mm;
    }
    .day-header {
      background: linear-gradient(to right, #2563eb, #1d4ed8);
      color: white;
      padding: 1mm 2mm;
      margin-bottom: 1mm;
      border-radius: 1mm;
    }
    .day-header h2 {
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 0.5mm;
    }
    .work-block {
      margin-bottom: 1mm;
    }
    .work-block-title {
      background: #f1f5f9;
      padding: 0.5mm 1.5mm;
      font-weight: bold;
      font-size: 6pt;
      border-left: 2px solid #2563eb;
      margin-bottom: 0.5mm;
    }
    .work-block-title.prep {
      border-left-color: #9333ea;
    }
    .work-block-title.brewing {
      border-left-color: #16a34a;
    }
    .work-block-title.analysis {
      border-left-color: #f97316;
    }
    .work-block-title.discharge {
      border-left-color: #dc2626;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    th, td {
      border: 0.3mm solid #cbd5e1;
      padding: 0.5mm 1mm;
      text-align: left;
    }
    th {
      background: #f8fafc;
      font-weight: bold;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .page {
        margin: 0;
        padding: 5mm;
      }
    }
  </style>
</head>
<body>
  ${pagesHTML}
</body>
</html>
  `;
};
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-xl font-bold text-slate-800 hover:text-blue-600 cursor-pointer"
                >
                  📅 {formatDate(currentDate)}
                </button>
                {showDatePicker && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-xl p-2 z-50">
                    <input
                      type="date"
                      value={currentDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value + 'T00:00:00');
                        setCurrentDate(newDate);
                        setShowDatePicker(false);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-bold text-slate-600">気温</label>
                  <input
  type="number"
  value={currentEnv.temperature}
  onChange={(e) => {
    dataContext.saveDailyEnvironment(
      currentDateKey, 
      e.target.value, 
      currentEnv.humidity
    );
  }}
  placeholder="25"
  className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
                  <span className="text-sm text-slate-600">℃</span>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-bold text-slate-600">湿度</label>
                  <input
  type="number"
  value={currentEnv.humidity}
  onChange={(e) => {
    dataContext.saveDailyEnvironment(
      currentDateKey, 
      currentEnv.temperature, 
      e.target.value
    );
  }}
  placeholder="60"
  className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
                  <span className="text-sm text-slate-600">%</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const prev = new Date(currentDate);
                  prev.setDate(prev.getDate() - 1);
                  setCurrentDate(prev);
                }}
                className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg font-bold"
              >
                ← 前日
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
              >
                今日
              </button>
              <button
                onClick={() => {
                  const next = new Date(currentDate);
                  next.setDate(next.getDate() + 1);
                  setCurrentDate(next);
                }}
                className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg font-bold"
              >
                翌日 →
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-orange-600 px-4 py-2">
            <h3 className="text-base font-bold text-white">
              🔬 本日の作業 - 分析予定
              {(() => {
                const analysisToday = todayWorks.analysisSchedules
                  .map(shubo => {
                    const dayNum = calculateDayNumber(shubo.shuboStartDate, currentDate);
                    const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
                    if (record?.isAnalysisDay) {
                      return `${shubo.displayName} ${dayNum}日目`;
                    }
                    return null;
                  })
                  .filter(item => item !== null);
                
                return analysisToday.length > 0 ? (
                  <span className="ml-2 text-sm font-normal">
                    ({analysisToday.join('、')})
                  </span>
                ) : null;
              })()}
            </h3>
          </div>
          <div className="p-4">
            {todayWorks.analysisSchedules.length === 0 ? (
              <p className="text-slate-500 text-center py-3 text-sm">分析対象の酒母はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
  <tr className="bg-slate-100 border-b">
    <th className="px-2 py-2 text-left text-xs font-bold">採取</th>
    <th className="px-2 py-2 text-left text-xs font-bold">酒母名</th>
    <th className="px-2 py-2 text-left text-xs font-bold">酵母</th>
    <th className="px-2 py-2 text-left text-xs font-bold">日数</th>
    <th className="px-2 py-2 text-left text-xs font-bold">ラベル</th>
    <th className="px-2 py-2 text-left text-xs font-bold">品温</th>
    <th className="px-2 py-2 text-left text-xs font-bold">ボーメ</th>
    <th className="px-2 py-2 text-left text-xs font-bold">直近ボーメ</th>
    <th className="px-2 py-2 text-left text-xs font-bold">酸度</th>
    <th className="px-2 py-2 text-left text-xs font-bold">加温後品温</th>
    <th className="px-2 py-2 text-left text-xs font-bold">午後品温</th>
    <th className="px-2 py-2 text-left text-xs font-bold">メモ</th>
  </tr>
</thead>
                  <tbody>
  {todayWorks.analysisSchedules.map(shubo => {
    const dayNum = calculateDayNumber(shubo.shuboStartDate, currentDate);
    const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
    
    const allRecords = dataContext.getDailyRecords(shubo.primaryNumber, shubo.fiscalYear);
    const recordsWithBaume = allRecords.filter(r => r.baume !== null).sort((a, b) => b.dayNumber - a.dayNumber);
    const latestBaume = recordsWithBaume.length > 0 ? recordsWithBaume[0] : null;

    return (
      <tr key={`${shubo.primaryNumber}-${shubo.fiscalYear}`} className="border-b hover:bg-slate-50">
        <td className="px-2 py-2 text-center">
          {record?.isAnalysisDay ? (
            <span className="text-blue-600 font-bold text-lg">○</span>
          ) : null}
        </td>
        <td className="px-2 py-2 font-bold text-blue-700 text-xs">{shubo.displayName}</td>
        <td className="px-2 py-2 text-xs">{shubo.originalData[0]?.yeast || '-'}</td>
        <td className="px-2 py-2 text-xs">{dayNum}日目</td>
        <td className="px-2 py-2">
          {record && (dayNum === 1 || dayNum === 2 || dayNum === shubo.maxShuboDays) ? (
            <span className="text-xs">{record.dayLabel}</span>
          ) : record ? (
            <select
              value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'dayLabel') as string}
              onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
                dayLabel: e.target.value
              })}
              onBlur={async (e) => {
                const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
                if (!record) return;
                const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
                const existingTimer = debounceTimers.current.get(key);
                if (existingTimer) {
                  clearTimeout(existingTimer);
                  debounceTimers.current.delete(key);
                }
                const mergedUpdates = localRecordUpdates.get(key) || {};
                
                await dataContext.updateDailyRecord({ 
                  ...record, 
                  ...mergedUpdates, 
                  dayLabel: e.target.value 
                });
              }}
              className="w-16 px-1 py-1 text-xs border rounded"
            >
              <option value="-">-</option>
              <option value="暖気">暖気</option>
              <option value="分け">分け</option>
              <option value="卸し">卸し</option>
            </select>
          ) : <span>-</span>}
        </td>
        <td className="px-2 py-2">
          <input 
            type="number" 
            step="0.1" 
            value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'temperature1')} 
            onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
              temperature1: e.target.value ? parseFloat(e.target.value) : null
            })}
            onBlur={async (e) => {
              const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
              if (!record) return;
              const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
              const existingTimer = debounceTimers.current.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                debounceTimers.current.delete(key);
              }
              const mergedUpdates = localRecordUpdates.get(key) || {};
              const value = e.target.value ? parseFloat(e.target.value) : null;
              
              await dataContext.updateDailyRecord({ 
                ...record, 
                ...mergedUpdates, 
                temperature1: value 
              });
            }}
            placeholder="20.5" 
            className="w-14 px-1 py-1 text-xs border rounded" 
          />
        </td>
        <td className="px-2 py-2">
          <input 
            type="number" 
            step="0.1" 
            value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'baume')} 
            onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
              baume: e.target.value ? parseFloat(e.target.value) : null
            })}
            onBlur={async (e) => {
              const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
              if (!record) return;
              const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
              const existingTimer = debounceTimers.current.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                debounceTimers.current.delete(key);
              }
              const mergedUpdates = localRecordUpdates.get(key) || {};
              const value = e.target.value ? parseFloat(e.target.value) : null;
              
              await dataContext.updateDailyRecord({ 
                ...record, 
                ...mergedUpdates, 
                baume: value 
              });
            }}
            placeholder="10.5" 
            className="w-14 px-1 py-1 text-xs border rounded" 
          />
        </td>
        <td className="px-2 py-2">
          {latestBaume ? (
            <span className="text-orange-600 font-semibold text-xs">
              {latestBaume.dayNumber}日目 {latestBaume.baume}
            </span>
          ) : (
            <span className="text-slate-400 text-xs">-</span>
          )}
        </td>
        <td className="px-2 py-2">
          <input 
            type="number" 
            step="0.1" 
            value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'acidity')} 
            onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
              acidity: e.target.value ? parseFloat(e.target.value) : null
            })}
            onBlur={async (e) => {
              const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
              if (!record) return;
              const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
              const existingTimer = debounceTimers.current.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                debounceTimers.current.delete(key);
              }
              const mergedUpdates = localRecordUpdates.get(key) || {};
              const value = e.target.value ? parseFloat(e.target.value) : null;
              
              await dataContext.updateDailyRecord({ 
                ...record, 
                ...mergedUpdates, 
                acidity: value 
              });
            }}
            placeholder="2.5" 
            className="w-14 px-1 py-1 text-xs border rounded" 
          />
        </td>
        <td className="px-2 py-2">
          <input 
            type="number" 
            step="0.1" 
            value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'temperature2')} 
            onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
              temperature2: e.target.value ? parseFloat(e.target.value) : null
            })}
            onBlur={async (e) => {
              const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
              if (!record) return;
              const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
              const existingTimer = debounceTimers.current.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                debounceTimers.current.delete(key);
              }
              const mergedUpdates = localRecordUpdates.get(key) || {};
              const value = e.target.value ? parseFloat(e.target.value) : null;
              
              await dataContext.updateDailyRecord({ 
                ...record, 
                ...mergedUpdates, 
                temperature2: value 
              });
            }}
            placeholder="22.0" 
            className="w-14 px-1 py-1 text-xs border rounded" 
          />
        </td>
        <td className="px-2 py-2">
          <input 
            type="number" 
            step="0.1" 
            value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'temperature3')} 
            onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
              temperature3: e.target.value ? parseFloat(e.target.value) : null
            })}
            onBlur={async (e) => {
              const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
              if (!record) return;
              const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
              const existingTimer = debounceTimers.current.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                debounceTimers.current.delete(key);
              }
              const mergedUpdates = localRecordUpdates.get(key) || {};
              const value = e.target.value ? parseFloat(e.target.value) : null;
              
              await dataContext.updateDailyRecord({ 
                ...record, 
                ...mergedUpdates, 
                temperature3: value 
              });
            }}
            placeholder="21.0" 
            className="w-14 px-1 py-1 text-xs border rounded" 
          />
        </td>
        <td className="px-2 py-2">
          <input 
            type="text" 
            value={getDisplayRecordValue(shubo.primaryNumber, dayNum, 'memo')} 
            onChange={(e) => updateAnalysisRecord(shubo.primaryNumber, dayNum, {
              memo: e.target.value
            })}
            onBlur={async (e) => {
              const record = getTodayAnalysisRecord(shubo.primaryNumber, dayNum);
              if (!record) return;
              const key = `analysis-${shubo.primaryNumber}-${record.fiscalYear}-${dayNum}`;
              const existingTimer = debounceTimers.current.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                debounceTimers.current.delete(key);
              }
              const mergedUpdates = localRecordUpdates.get(key) || {};
              const value = e.target.value;
              
              await dataContext.updateDailyRecord({ 
                ...record, 
                ...mergedUpdates, 
                memo: value 
              });
            }}
            placeholder="順調" 
            className="w-full px-2 py-1 text-xs border rounded" 
          />
        </td>
      </tr>
    );
  })}
</tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
            <div className="bg-purple-600 px-4 py-2">
              <h3 className="text-sm font-bold text-white">🧪 仕込み準備（明日）</h3>
            </div>
            <div className="p-4">
              {todayWorks.preparations.length === 0 ? (
                <p className="text-slate-500 text-center py-3 text-sm">仕込み準備なし</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="px-2 py-2 text-left text-xs font-bold">酒母</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">タンク</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">汲み水</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">氷量</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">準備水</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">尺</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">乳酸</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayWorks.preparations.map(shubo => {
                        const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
                        const waterAmount = shubo.recipeData.water;
                        const lacticAcidAmount = shubo.recipeData.lacticAcid;
                        
                        let waterDisplay = `${waterAmount}L`;
                        let lacticDisplay = `${lacticAcidAmount}ml`;
                        
                        if (isDual && dataContext.configuredShuboData && dataContext.configuredShuboData.length > 0) {
                          const primary = dataContext.configuredShuboData.find(s => s.shuboNumber === shubo.primaryNumber);
                          const secondary = dataContext.configuredShuboData.find(s => s.shuboNumber === shubo.secondaryNumber);
                          
                          if (primary && secondary) {
                            const primaryWater = primary.recipeData.water;
                            const secondaryWater = secondary.recipeData.water;
                            const primaryLactic = primary.recipeData.lacticAcid;
                            const secondaryLactic = secondary.recipeData.lacticAcid;
                            
                            waterDisplay = `${waterAmount}L (${primaryWater}+${secondaryWater})`;
                            lacticDisplay = `${lacticAcidAmount}ml (${primaryLactic}+${secondaryLactic})`;
                          }
                        }
                        
                        const iceAmount = getDisplayBrewingValue(shubo.primaryNumber, shubo.fiscalYear, 'iceAmount');
                        const preparationWater = iceAmount ? waterAmount - Number(iceAmount) : waterAmount;
                        const kensyaku = getKensyakuFromCapacity(shubo.selectedTankId, preparationWater);

                        return (
                          <tr key={`${shubo.primaryNumber}-${shubo.fiscalYear}`} className="border-b hover:bg-slate-50">
                            <td className="px-2 py-2 font-bold text-blue-700 text-xs">{shubo.displayName}</td>
                            <td className="px-2 py-2 text-xs">{shubo.selectedTankId}</td>
                            <td className="px-2 py-2 text-xs">{waterDisplay}</td>
                            <td className="px-2 py-2">
                            <input 
                              type="number" 
                              value={iceAmount} 
                              onChange={(e) => updateBrewingInput(
                                shubo.primaryNumber,
                                shubo.fiscalYear,
                                'iceAmount',
                                e.target.value ? parseFloat(e.target.value) : null
                              )}
                              onBlur={async (e) => {
                                const key = `${shubo.primaryNumber}-${shubo.fiscalYear}`;
                                const timerKey = `brewing-prep-${key}`;
                                const existingTimer = debounceTimers.current.get(timerKey);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(timerKey);
                                }
                                const mergedUpdates = localBrewingUpdates.get(key) || {};
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                
                               
                                
                                await dataContext.saveBrewingPreparation(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  {
                                    ...brewingInput[key],
                                    ...mergedUpdates,
                                    iceAmount: value
                                  }
                                );
                                
                             
                              }}
                              placeholder="0" 
                              className="w-14 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                            <td className="px-2 py-2 text-green-700 font-bold text-xs">
                              {iceAmount ? `${preparationWater}L` : '-'}
                            </td>
                            <td className="px-2 py-2 text-slate-700 text-xs">
                              {kensyaku !== null ? `${kensyaku}mm` : '-'}
                            </td>
                            <td className="px-2 py-2 text-xs">{lacticDisplay}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
            <div className="bg-green-600 px-4 py-2">
              <h3 className="text-sm font-bold text-white">🌾 仕込み予定（本日）</h3>
            </div>
            <div className="p-4">
              {todayWorks.brewingSchedules.length === 0 ? (
                <p className="text-slate-500 text-center py-3 text-sm">仕込み予定なし</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="px-2 py-2 text-left text-xs font-bold">酒母</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">タンク</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">水麹温度</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">仕込温度</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測予定</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測尺</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測</th>
                        <th className="px-2 py-2 text-left text-xs font-bold">留測歩合</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayWorks.brewingSchedules.map(shubo => {
                        const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
                        const expectedMeasurement = shubo.recipeData.measurement;

                        let measurementDisplay = `${expectedMeasurement}L`;

                        if (isDual) {
                          const primaryMeasurement = shubo.individualRecipeData[0].measurement;
                          const secondaryMeasurement = shubo.individualRecipeData[1].measurement;
                          measurementDisplay = `${expectedMeasurement}L (${primaryMeasurement}+${secondaryMeasurement})`;
                        }
                        
                        const afterBrewingKensyaku = getDisplayBrewingValue(shubo.primaryNumber, shubo.fiscalYear, 'afterBrewingKensyaku');
                        const capacity = afterBrewingKensyaku 
                          ? getCapacityFromKensyaku(shubo.selectedTankId, Number(afterBrewingKensyaku)) 
                          : null;
                        const ratio = capacity && expectedMeasurement 
                          ? ((capacity / expectedMeasurement) * 100).toFixed(1) 
                          : null;

                        return (
                          <tr key={`${shubo.primaryNumber}-${shubo.fiscalYear}`} className="border-b hover:bg-slate-50">
                            <td className="px-2 py-2 font-bold text-blue-700 text-xs">{shubo.displayName}</td>
                            <td className="px-2 py-2 text-xs">{shubo.selectedTankId}</td>
                            <td className="px-2 py-2">
                            <input 
                              type="number" 
                              value={getDisplayRecordValue(shubo.primaryNumber, 1, 'temperature1')} 
                              onChange={(e) => updateBrewingRecord(shubo.primaryNumber, {
                                temperature1: e.target.value ? parseFloat(e.target.value) : null
                              })}
                              onBlur={async (e) => {
                                const record = getDay1Record(shubo.primaryNumber);
                                if (!record) return;
                                const key = `brewing-${shubo.primaryNumber}-${record.fiscalYear}-1`;
                                const existingTimer = debounceTimers.current.get(key);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(key);
                                }
                                const mergedUpdates = localRecordUpdates.get(key) || {};
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                
                            
                                
                                await dataContext.updateDailyRecord({ 
                                  ...record, 
                                  ...mergedUpdates, 
                                  temperature1: value 
                                });
                                
                                
                              }}
                              placeholder="15" 
                              className="w-12 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                            <td className="px-2 py-2">
                            <input 
                              type="number" 
                              value={getDisplayRecordValue(shubo.primaryNumber, 1, 'temperature2')} 
                              onChange={(e) => updateBrewingRecord(shubo.primaryNumber, {
                                temperature2: e.target.value ? parseFloat(e.target.value) : null
                              })}
                              onBlur={async (e) => {
                                const record = getDay1Record(shubo.primaryNumber);
                                if (!record) return;
                                const key = `brewing-${shubo.primaryNumber}-${record.fiscalYear}-1`;
                                const existingTimer = debounceTimers.current.get(key);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(key);
                                }
                                const mergedUpdates = localRecordUpdates.get(key) || {};
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                
                             
                                
                                await dataContext.updateDailyRecord({ 
                                  ...record, 
                                  ...mergedUpdates, 
                                  temperature2: value 
                                });
                                
                              
                              }}
                              placeholder="18" 
                              className="w-12 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                            <td className="px-2 py-2 text-xs">{measurementDisplay}</td>
                            <td className="px-2 py-2">
                            <input 
                              type="number" 
                              value={afterBrewingKensyaku} 
                              onChange={(e) => updateBrewingInput(
                                shubo.primaryNumber,
                                shubo.fiscalYear,
                                'afterBrewingKensyaku',
                                e.target.value ? parseFloat(e.target.value) : null
                              )}
                              onBlur={async (e) => {
                                const key = `${shubo.primaryNumber}-${shubo.fiscalYear}`;
                                const timerKey = `brewing-prep-${key}`;
                                const existingTimer = debounceTimers.current.get(timerKey);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(timerKey);
                                }
                                const mergedUpdates = localBrewingUpdates.get(key) || {};
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                
                               
                                
                                await dataContext.saveBrewingPreparation(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  {
                                    ...brewingInput[key],
                                    ...mergedUpdates,
                                    afterBrewingKensyaku: value
                                  }
                                );
                                
                              
                              }}
                              placeholder="300" 
                              className="w-14 px-1 py-1 text-xs border rounded" 
                            />
                          </td>
                            <td className="px-2 py-2 text-green-700 font-bold text-xs">
                              {capacity ? `${capacity}L` : '-'}
                            </td>
                            <td className="px-2 py-2 text-blue-700 font-bold text-xs">
                              {ratio ? `${ratio}%` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-red-600 px-4 py-2">
            <h3 className="text-base font-bold text-white">📤 本日の作業 - 卸し予定</h3>
          </div>
          <div className="p-4">
            {todayWorks.dischargeSchedules.length === 0 ? (
              <p className="text-slate-500 text-center py-3 text-sm">本日の卸し予定はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="px-3 py-2 text-left text-xs font-bold">酒母名</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">タンク</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸前尺</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸前容量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸後容量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸後尺</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">卸し量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">添タンク</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">汲み水量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">氷量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">準備添汲水量</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">準備添汲水尺</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayWorks.dischargeSchedules.map(shubo => {
                      const dischargeIndex = shubo.shuboEndDates.findIndex(endDate => {
                        const date = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
                        date.setHours(0, 0, 0, 0);
                        const today = new Date(currentDate);
                        today.setHours(0, 0, 0, 0);
                        return date.getTime() === today.getTime();
                      });
                      
                      const beforeDischargeKensyaku = getDisplayDischargeValue(shubo.primaryNumber, shubo.fiscalYear, dischargeIndex + 1, 'beforeDischargeKensyaku');
                      const afterDischargeCapacity = getDisplayDischargeValue(shubo.primaryNumber, shubo.fiscalYear, dischargeIndex + 1, 'afterDischargeCapacity');
                      const destinationTank = getDisplayDischargeValue(shubo.primaryNumber, shubo.fiscalYear, dischargeIndex + 1, 'destinationTank');
                      const iceAmount = getDisplayDischargeValue(shubo.primaryNumber, shubo.fiscalYear, dischargeIndex + 1, 'iceAmount');

                      const beforeCapacity = beforeDischargeKensyaku 
                        ? getCapacityFromKensyaku(shubo.selectedTankId, Number(beforeDischargeKensyaku)) 
                        : null;
                      const afterCapacity = afterDischargeCapacity !== null && afterDischargeCapacity !== '' ? Number(afterDischargeCapacity) : null;
                      const afterKensyaku = afterCapacity !== null && afterCapacity >= 0
                        ? getKensyakuFromCapacity(shubo.selectedTankId, afterCapacity)
                        : null;
                      const dischargeAmount = beforeCapacity !== null && afterCapacity !== null
                        ? beforeCapacity - afterCapacity 
                        : null;

                      const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
                      let soeWaterReference: number | null = null;
                      
                      if (isDual && shubo.individualRecipeData && shubo.individualRecipeData[dischargeIndex]) {
                        const individualRecipe = dataContext.recipeRawData.find(r => 
                          r.shuboType === shubo.shuboType && 
                          r.recipeBrewingScale === shubo.originalData[dischargeIndex].brewingScale
                        );
                        soeWaterReference = individualRecipe?.初添_汲み水 || null;
                      } else {
                        const recipe = dataContext.recipeRawData.find(r => 
                          r.shuboType === shubo.shuboType && 
                          r.recipeBrewingScale === shubo.originalData[0].brewingScale
                        );
                        soeWaterReference = recipe?.初添_汲み水 || null;
                      }

                      const preparationSoeWater = soeWaterReference !== null && iceAmount
                        ? soeWaterReference - Number(iceAmount)
                        : null;
                      const preparationSoeKensyaku = preparationSoeWater !== null && destinationTank
                        ? getKensyakuFromCapacity(String(destinationTank), preparationSoeWater)
                        : null;

                      return (
                        <tr key={`${shubo.primaryNumber}-${shubo.fiscalYear}`} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-blue-700">{shubo.displayName}</td>
                          <td className="px-3 py-2">{shubo.selectedTankId}</td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={beforeDischargeKensyaku} 
                              onChange={(e) => updateDischargeInput(
                                shubo.primaryNumber,
                                shubo.fiscalYear,
                                dischargeIndex + 1,
                                'beforeDischargeKensyaku',
                                e.target.value ? parseFloat(e.target.value) : null
                              )}
                              onBlur={async (e) => {
                                const key = `${shubo.primaryNumber}-${shubo.fiscalYear}-${dischargeIndex + 1}`;
                                const timerKey = `discharge-${key}`;
                                const existingTimer = debounceTimers.current.get(timerKey);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(timerKey);
                                }
                                const mergedUpdates = localDischargeUpdates.get(key) || {};
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                
                                setLocalDischargeUpdates(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(key, { ...mergedUpdates, beforeDischargeKensyaku: value });
                                  return newMap;
                                });
                                
                                await dataContext.saveDischargeSchedule(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  dischargeIndex + 1,
                                  {
                                    ...dischargeInput[key],
                                    ...mergedUpdates,
                                    beforeDischargeKensyaku: value
                                  }
                                );
                                
                            
                              }}
                              placeholder="250" 
                              className="w-16 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                          <td className="px-3 py-2 text-green-700 font-bold">
                            {beforeCapacity ? `${beforeCapacity}L` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={afterDischargeCapacity} 
                              onChange={(e) => updateDischargeInput(
                                shubo.primaryNumber,
                                shubo.fiscalYear,
                                dischargeIndex + 1,
                                'afterDischargeCapacity',
                                e.target.value !== '' ? parseFloat(e.target.value) : null
                              )}
                              onBlur={async (e) => {
                                const key = `${shubo.primaryNumber}-${shubo.fiscalYear}-${dischargeIndex + 1}`;
                                const timerKey = `discharge-${key}`;
                                const existingTimer = debounceTimers.current.get(timerKey);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(timerKey);
                                }
                                const mergedUpdates = localDischargeUpdates.get(key) || {};
                                const value = e.target.value !== '' ? parseFloat(e.target.value) : null;
                                
                                setLocalDischargeUpdates(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(key, { ...mergedUpdates, afterDischargeCapacity: value });
                                  return newMap;
                                });
                                
                                await dataContext.saveDischargeSchedule(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  dischargeIndex + 1,
                                  {
                                    ...dischargeInput[key],
                                    ...mergedUpdates,
                                    afterDischargeCapacity: value
                                  }
                                );
                                
                              }}
                              placeholder="200" 
                              className="w-16 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {afterKensyaku !== null ? `${afterKensyaku}mm` : '-'}
                          </td>
                          <td className="px-3 py-2 text-blue-700 font-bold">
                            {dischargeAmount ? `${dischargeAmount}L` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={destinationTank}
                              onChange={async (e) => {
                                await updateDischargeInput(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  dischargeIndex + 1,
                                  'destinationTank',
                                  e.target.value
                                );
                              }}
                              onBlur={async (e) => {
                                const key = `${shubo.primaryNumber}-${shubo.fiscalYear}-${dischargeIndex + 1}`;
                                const timerKey = `discharge-${key}`;
                                const existingTimer = debounceTimers.current.get(timerKey);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(timerKey);
                                }
                                const mergedUpdates = localDischargeUpdates.get(key) || {};
                                const value = e.target.value;
                                
                                setLocalDischargeUpdates(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(key, { ...mergedUpdates, destinationTank: value });
                                  return newMap;
                                });
                                
                                await dataContext.saveDischargeSchedule(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  dischargeIndex + 1,
                                  {
                                    ...dischargeInput[key],
                                    ...mergedUpdates,
                                    destinationTank: value
                                  }
                                );
                                
                              
                              }}
                              className="w-24 px-2 py-1 text-sm border rounded"
                            >
                              <option value="">選択</option>
                              {dataContext.tankConfigData
                                .map((tank: any) => (
                                  <option key={tank.tankId} value={tank.tankId}>
                                    {tank.tankId}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {soeWaterReference ? `${soeWaterReference}L` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={iceAmount} 
                              onChange={(e) => updateDischargeInput(
                                shubo.primaryNumber,
                                shubo.fiscalYear,
                                dischargeIndex + 1,
                                'iceAmount',
                                e.target.value ? parseFloat(e.target.value) : null
                              )}
                              onBlur={async (e) => {
                                const key = `${shubo.primaryNumber}-${shubo.fiscalYear}-${dischargeIndex + 1}`;
                                const timerKey = `discharge-${key}`;
                                const existingTimer = debounceTimers.current.get(timerKey);
                                if (existingTimer) {
                                  clearTimeout(existingTimer);
                                  debounceTimers.current.delete(timerKey);
                                }
                                const mergedUpdates = localDischargeUpdates.get(key) || {};
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                
                                setLocalDischargeUpdates(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(key, { ...mergedUpdates, iceAmount: value });
                                  return newMap;
                                });
                                
                                await dataContext.saveDischargeSchedule(
                                  shubo.primaryNumber,
                                  shubo.fiscalYear,
                                  dischargeIndex + 1,
                                  {
                                    ...dischargeInput[key],
                                    ...mergedUpdates,
                                    iceAmount: value
                                  }
                                );
                                
                           
                              }}
                              placeholder="0" 
                              className="w-16 px-2 py-1 text-sm border rounded" 
                            />
                          </td>
                          <td className="px-3 py-2 text-green-700 font-bold">
                            {preparationSoeWater !== null ? `${preparationSoeWater}L` : '-'}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {preparationSoeKensyaku !== null ? `${preparationSoeKensyaku}mm` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-slate-800 px-4 py-2">
            <h3 className="text-base font-bold text-white">📋 酒母一覧</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="px-3 py-2 text-left text-xs font-bold">酒母名</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">タンク</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">日数</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">仕込み日</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">卸日</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">期間</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">酵母</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {shuboList.map((shubo) => {
                  const statusColor = 
                    shubo.status === '管理中' ? 'bg-green-100 text-green-800' :
                    shubo.status === '準備中' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-slate-100 text-slate-600';

                  const isExpanded = expandedShubo === shubo.primaryNumber;

                  return (
                    <Fragment key={shubo.primaryNumber}>
                      <tr 
                        onClick={() => handleShuboClick(shubo.primaryNumber)}
                        className={`border-b hover:bg-slate-50 cursor-pointer ${shubo.status === '管理中' ? 'bg-green-50' : ''}`}
                      >
                        <td className="px-3 py-2 font-bold text-blue-700">
                          <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                          {shubo.displayName}
                        </td>
                        <td className="px-3 py-2">{shubo.selectedTankId}</td>
                        <td className="px-3 py-2">
                          {shubo.dayNumber ? `${shubo.dayNumber}日目` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {(() => {
                            const startDate = shubo.shuboStartDate instanceof Date 
                              ? shubo.shuboStartDate 
                              : new Date(shubo.shuboStartDate);
                            return startDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          {shubo.shuboEndDates.map((endDate) => {
                            const date = endDate instanceof Date ? endDate : new Date(endDate);
                            return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                          }).join(', ')}
                        </td>
                        <td className="px-3 py-2">{shubo.period}日</td>
                        <td className="px-3 py-2 text-xs">{shubo.originalData[0]?.yeast || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                            {shubo.status}
                          </span>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <ShuboDetailExpansion
                          shubo={shubo}
                          records={getShuboRecords(shubo)}
                          dailyEnvironment={dailyEnvironment}
                          onUpdateRecord={handleUpdateRecord}
                          brewingInput={brewingInput[createShuboKey(shubo.primaryNumber, shubo.fiscalYear)]}
                          dischargeInput={
                            shubo.shuboEndDates.map((_, index) => {
                              const key = `${shubo.primaryNumber}-${shubo.fiscalYear}-${index + 1}`;
                              const input = dischargeInput[key];
                              return input || {
                                beforeDischargeKensyaku: null,
                                afterDischargeCapacity: null
                              };
                            })
                          }
                          getCapacityFromKensyaku={getCapacityFromKensyaku}
                          analysisSettings={dataContext.analysisSettings}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
<div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-indigo-600 px-4 py-2">
            <h3 className="text-base font-bold text-white">📋 予定表出力</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">開始日</label>
                <input
                  type="date"
                  value={scheduleStartDate}
                  onChange={(e) => setScheduleStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">終了日</label>
                <input
                  type="date"
                  value={scheduleEndDate}
                  onChange={(e) => setScheduleEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={handleScheduleExport}
              disabled={!scheduleStartDate || !scheduleEndDate}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg transition-all"
            >
              📥 予定表HTML出力
            </button>
            <p className="text-xs text-slate-500 mt-3">
              ※ A4縦で4日分/ページとして出力されます
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}