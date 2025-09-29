import { useState, useEffect } from 'react';
import type { DailyRecordData, MergedShuboData } from '../utils/types';
import { DAY_LABEL_OPTIONS } from '../utils/types';
import { formatShortDate, dateToKey } from '../utils/dataUtils';

interface ShuboDetailExpansionProps {
  shubo: MergedShuboData;
  records: DailyRecordData[];
  dailyEnvironment: { [key: string]: { temperature: string; humidity: string } };
  onUpdateRecord: (record: DailyRecordData) => void;
}

export default function ShuboDetailExpansion({
  shubo,
  records,
  dailyEnvironment,
  onUpdateRecord
}: ShuboDetailExpansionProps) {
  const [localRecords, setLocalRecords] = useState<DailyRecordData[]>(records);

  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  const updateRecord = (dayNumber: number, updates: Partial<DailyRecordData>) => {
    const updatedRecords = localRecords.map(record => {
      if (record.dayNumber === dayNumber) {
        const updated = { ...record, ...updates };
        onUpdateRecord(updated);
        return updated;
      }
      return record;
    });
    setLocalRecords(updatedRecords);
  };

  console.log('ShuboDetailExpansion records:', localRecords.length, localRecords.map(r => r.dayNumber));

  return (
    <tr>
      <td colSpan={8} className="bg-slate-50 p-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 px-4 py-2">
            <h4 className="text-white font-bold text-sm">📊 日別記録テーブル ({localRecords.length}日分)</h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-left font-bold w-24 sticky left-0 bg-slate-100 z-10">項目</th>
                  {localRecords.map((record) => (
                    <th key={record.dayNumber} className="border border-slate-300 px-2 py-1 text-center font-bold min-w-[100px]">
                      {record.dayNumber}日
                    </th>
                  ))}
                </tr>
                
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1 font-bold sticky left-0 bg-slate-50 z-10">ラベル</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-1 text-center">
                      {record.dayNumber === 1 || record.dayNumber === 2 || record.dayNumber === shubo.maxShuboDays ? (
                        <span className="font-bold text-blue-700">{record.dayLabel}</span>
                      ) : (
                        <select
                          value={record.dayLabel}
                          onChange={(e) => updateRecord(record.dayNumber, { dayLabel: e.target.value })}
                          className="w-full px-1 py-0.5 text-xs border rounded text-center"
                        >
                          {DAY_LABEL_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  ))}
                </tr>
                
                <tr className="bg-slate-100">
                  <td className="border border-slate-300 px-2 py-1 font-bold sticky left-0 bg-slate-100 z-10">日付</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-1 text-center text-slate-600">
                      {formatShortDate(record.recordDate)}
                    </td>
                  ))}
                </tr>
              </thead>
              
              <tbody>
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">分析日</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={record.isAnalysisDay}
                        onChange={(e) => updateRecord(record.dayNumber, { isAnalysisDay: e.target.checked })}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">品温①</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={record.temperature1 ?? ''}
                        onChange={(e) => updateRecord(record.dayNumber, { 
                          temperature1: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder=""
                        className="w-full px-1 py-1 text-xs border rounded text-center"
                      />
                    </td>
                  ))}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">品温②</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={record.temperature2 ?? ''}
                        onChange={(e) => updateRecord(record.dayNumber, { 
                          temperature2: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder=""
                        className="w-full px-1 py-1 text-xs border rounded text-center"
                      />
                    </td>
                  ))}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">気温</td>
                  {localRecords.map((record) => {
                    const dateKey = dateToKey(record.recordDate);
                    const temp = dailyEnvironment[dateKey]?.temperature || '-';
                    return (
                      <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center text-slate-600">
                        {temp}
                      </td>
                    );
                  })}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">ボーメ</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={record.baume ?? ''}
                        onChange={(e) => updateRecord(record.dayNumber, { 
                          baume: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder=""
                        className="w-full px-1 py-1 text-xs border rounded text-center"
                      />
                    </td>
                  ))}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">酸度</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={record.acidity ?? ''}
                        onChange={(e) => updateRecord(record.dayNumber, { 
                          acidity: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder=""
                        className="w-full px-1 py-1 text-xs border rounded text-center"
                      />
                    </td>
                  ))}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">アルコール</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={record.alcohol ?? ''}
                        onChange={(e) => updateRecord(record.dayNumber, { 
                          alcohol: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder=""
                        className="w-full px-1 py-1 text-xs border rounded text-center"
                      />
                    </td>
                  ))}
                </tr>
                
                <tr className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">メモ</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="text"
                        value={record.memo}
                        onChange={(e) => updateRecord(record.dayNumber, { memo: e.target.value })}
                        placeholder=""
                        className="w-full px-1 py-1 text-xs border rounded text-center"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}