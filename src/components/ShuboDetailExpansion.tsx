import { useState, useEffect, useRef } from 'react';
import type { DailyRecordData, MergedShuboData } from '../utils/types';
import { DAY_LABEL_OPTIONS } from '../utils/types';
import { formatShortDate, dateToKey } from '../utils/dataUtils';

interface ShuboDetailExpansionProps {
  shubo: MergedShuboData;
  records: DailyRecordData[];
  dailyEnvironment: { [key: string]: { temperature: string; humidity: string } };
  onUpdateRecord: (record: DailyRecordData) => void;
  brewingInput?: { afterBrewingKensyaku: number | null };
  dischargeInput?: { 
    beforeDischargeKensyaku: number | null;
    afterDischargeCapacity: number | null;
  }[];
  getCapacityFromKensyaku?: (tankId: string, kensyaku: number) => number | null;
}

export default function ShuboDetailExpansion({
  shubo,
  records,
  dailyEnvironment,
  onUpdateRecord,
  brewingInput,
  dischargeInput = [],
  getCapacityFromKensyaku
}: ShuboDetailExpansionProps) {
  const [localRecords, setLocalRecords] = useState<DailyRecordData[]>(records);
  const tableRef = useRef<HTMLTableElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  useEffect(() => {
    if (tableRef.current) {
      const headerCells = tableRef.current.querySelectorAll('thead tr:first-child th');
      const widths: number[] = [];
      headerCells.forEach((cell, index) => {
        if (index > 0) {
          widths.push((cell as HTMLElement).offsetWidth);
        }
      });
      setColumnWidths(widths);
    }
  }, [localRecords]);

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

  const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
  
  const formatRecipeValue = (total: number, unit: string) => {
    if (!isDual) return `${total}${unit}`;
    const individual = total / 2;
    return `${total}(${individual}+${individual})${unit}`;
  };

  const brewingKensyaku = brewingInput?.afterBrewingKensyaku;
  const brewingCapacity = brewingKensyaku && getCapacityFromKensyaku 
    ? getCapacityFromKensyaku(shubo.selectedTankId, brewingKensyaku)
    : null;
  const brewingRatio = brewingCapacity && shubo.recipeData.measurement
    ? ((brewingCapacity / shubo.recipeData.measurement) * 100).toFixed(1)
    : null;

  const graphHeight = 200;
  const graphPadding = { top: 10, bottom: 20, left: 40, right: 10 };
  const maxTemp = 30;
  
  const tempToY = (temp: number) => {
    return graphPadding.top + ((maxTemp - temp) / maxTemp) * (graphHeight - graphPadding.top - graphPadding.bottom);
  };

  const graphData = localRecords.map((record, index) => {
    const dateKey = dateToKey(new Date(record.recordDate));
    const airTemp = dailyEnvironment[dateKey]?.temperature;
    
    return {
      dayNumber: record.dayNumber,
      x: index,
      temp1: record.temperature1,
      temp2: record.temperature2,
      temp3: record.temperature3,
      airTemp: airTemp && airTemp !== '-' ? parseFloat(airTemp) : null
    };
  });

  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  const graphWidth = totalWidth + graphPadding.left + graphPadding.right;

  console.log('ShuboDetailExpansion records:', localRecords.length, localRecords.map(r => r.dayNumber));

  return (
    <tr>
      <td colSpan={8} className="bg-slate-50 p-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          
          <div className="grid grid-cols-5 gap-4 p-4 border-b border-slate-200 bg-slate-50">
            <div className="space-y-1">
              <h5 className="font-bold text-xs text-slate-700 mb-2 border-b border-slate-300 pb-1">基本情報①</h5>
              <div className="text-xs"><span className="text-slate-600">酒母:</span> <span className="font-semibold">{shubo.displayName}</span></div>
              <div className="text-xs"><span className="text-slate-600">タンク:</span> <span className="font-semibold">{shubo.selectedTankId}</span></div>
              <div className="text-xs"><span className="text-slate-600">酛種類:</span> <span className="font-semibold">{shubo.shuboType}</span></div>
              <div className="text-xs"><span className="text-slate-600">仕込規模:</span> <span className="font-semibold">{shubo.originalData[0].brewingScale}kg</span></div>
              <div className="text-xs"><span className="text-slate-600">酵母:</span> <span className="font-semibold">{shubo.originalData[0].yeast}</span></div>
            </div>

            <div className="space-y-1">
              <h5 className="font-bold text-xs text-slate-700 mb-2 border-b border-slate-300 pb-1">基本情報②</h5>
              <div className="text-xs"><span className="text-slate-600">仕込区分:</span> <span className="font-semibold">{shubo.originalData[0].brewingCategory}</span></div>
              <div className="text-xs"><span className="text-slate-600">麹米:</span> <span className="font-semibold">{shubo.originalData[0].kojiRiceVariety}</span></div>
              <div className="text-xs"><span className="text-slate-600">掛米:</span> <span className="font-semibold">{shubo.originalData[0].kakeRiceVariety}</span></div>
              <div className="text-xs"><span className="text-slate-600">備考:</span> <span className="font-semibold">{shubo.originalData[0].memo}</span></div>
            </div>

            <div className="space-y-1">
              <h5 className="font-bold text-xs text-slate-700 mb-2 border-b border-slate-300 pb-1">配合情報</h5>
              <div className="text-xs"><span className="text-slate-600">総米:</span> <span className="font-semibold">{formatRecipeValue(shubo.recipeData.totalRice, 'kg')}</span></div>
              <div className="text-xs"><span className="text-slate-600">蒸米:</span> <span className="font-semibold">{formatRecipeValue(shubo.recipeData.steamedRice, 'kg')}</span></div>
              <div className="text-xs"><span className="text-slate-600">麹米:</span> <span className="font-semibold">{formatRecipeValue(shubo.recipeData.kojiRice, 'kg')}</span></div>
              <div className="text-xs"><span className="text-slate-600">汲み水:</span> <span className="font-semibold">{formatRecipeValue(shubo.recipeData.water, 'L')}</span></div>
              <div className="text-xs"><span className="text-slate-600">乳酸:</span> <span className="font-semibold">{formatRecipeValue(shubo.recipeData.lacticAcid, 'ml')}</span></div>
            </div>

            <div className="space-y-1">
              <h5 className="font-bold text-xs text-slate-700 mb-2 border-b border-slate-300 pb-1">仕込み情報</h5>
              <div className="text-xs"><span className="text-slate-600">留測尺:</span> <span className="font-semibold">{brewingKensyaku ? `${brewingKensyaku}mm` : '-'}</span></div>
              <div className="text-xs"><span className="text-slate-600">留測:</span> <span className="font-semibold">{brewingCapacity ? `${brewingCapacity}L` : '-'}</span></div>
              <div className="text-xs"><span className="text-slate-600">留測歩合:</span> <span className="font-semibold">{brewingRatio ? `${brewingRatio}%` : '-'}</span></div>
            </div>

            <div className="space-y-1">
              <h5 className="font-bold text-xs text-slate-700 mb-2 border-b border-slate-300 pb-1">卸し情報</h5>
              {dischargeInput.map((discharge, index) => {
                const beforeCapacity = discharge.beforeDischargeKensyaku && getCapacityFromKensyaku
                  ? getCapacityFromKensyaku(shubo.selectedTankId, discharge.beforeDischargeKensyaku)
                  : null;
                const afterCapacity = discharge.afterDischargeCapacity;
                const dischargeAmount = beforeCapacity !== null && afterCapacity !== null
                  ? beforeCapacity - afterCapacity
                  : null;
                
                const kensyakuAfter = '-';

                return (
                 <div key={index} className="space-y-0.5">
                    <div className="text-xs">
                      <span className="text-slate-600">卸{index + 1}前尺:</span> <span className="font-semibold">{discharge.beforeDischargeKensyaku ? `${discharge.beforeDischargeKensyaku}mm` : '-'}</span>
                      <span className="text-slate-600 ml-1">/卸{index + 1}前容量:</span> <span className="font-semibold">{beforeCapacity ? `${beforeCapacity}L` : '-'}</span>
                    </div>
                    {afterCapacity !== null && afterCapacity > 0 && (
                      <div className="text-xs">
                        <span className="text-slate-600">卸{index + 1}後尺:</span> <span className="font-semibold">{kensyakuAfter}</span>
                        <span className="text-slate-600 ml-1">/卸{index + 1}後容量:</span> <span className="font-semibold">{afterCapacity}L</span>
                      </div>
                    )}
                    <div className="text-xs"><span className="text-slate-600">卸{index + 1}量:</span> <span className="font-semibold">{dischargeAmount !== null ? `${dischargeAmount}L` : '-'}</span></div>
                  </div>
                );
              })}
              {dischargeInput.length === 0 && (
                <div className="text-xs text-slate-400">データなし</div>
              )}
            </div>
          </div>

          <div className="bg-blue-600 px-4 py-2">
            <h4 className="text-white font-bold text-sm">📊 日別記録テーブル ({localRecords.length}日分)</h4>
          </div>

          {columnWidths.length > 0 && (
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <svg width={graphWidth} height={graphHeight} className="bg-white border border-slate-300">
                {/* 横罫線（温度） */}
                {Array.from({ length: 16 }, (_, i) => i * 2).map(temp => (
                  <g key={temp}>
                    <line
                      x1={graphPadding.left}
                      y1={tempToY(temp)}
                      x2={graphWidth - graphPadding.right}
                      y2={tempToY(temp)}
                      stroke={temp % 10 === 0 ? '#94a3b8' : '#e2e8f0'}
                      strokeWidth={temp % 10 === 0 ? 1.5 : 0.5}
                    />
                    {temp % 10 === 0 && (
                      <text
                        x={graphPadding.left - 5}
                        y={tempToY(temp)}
                        textAnchor="end"
                        alignmentBaseline="middle"
                        fontSize="10"
                        fill="#64748b"
                      >
                        {temp}℃
                      </text>
                    )}
                  </g>
                ))}

                {/* 縦罫線（日単位） */}
                {columnWidths.map((_, index) => {
                  const xPos = graphPadding.left + columnWidths.slice(0, index + 1).reduce((sum, w) => sum + w, 0);
                  return (
                    <line
                      key={`vline-${index}`}
                      x1={xPos}
                      y1={graphPadding.top}
                      x2={xPos}
                      y2={graphHeight - graphPadding.bottom}
                      stroke="#e2e8f0"
                      strokeWidth={0.5}
                    />
                  );
                })}

                {/* 日数ラベル（下部） */}
                {localRecords.map((record, index) => {
                  const colWidth = columnWidths[index];
                  const colStart = graphPadding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
                  const xCenter = colStart + colWidth / 2;
                  return (
                    <text
                      key={`day-label-${record.dayNumber}`}
                      x={xCenter}
                      y={graphHeight - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748b"
                    >
                      {record.dayNumber}
                    </text>
                  );
                })}

                {(() => {
                  const tempPoints: Array<{ x: number; y: number }> = [];
                  graphData.forEach((data, index) => {
                    const colWidth = columnWidths[index];
                    const colStart = graphPadding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
                    const xPos1 = colStart + colWidth * 0.25;
                    const xPos2 = colStart + colWidth * 0.5;
                    const xPos3 = colStart + colWidth * 0.75;
                    
                    if (data.temp1 !== null) {
                      tempPoints.push({ x: xPos1, y: tempToY(data.temp1) });
                    }
                    if (data.temp2 !== null) {
                      tempPoints.push({ x: xPos2, y: tempToY(data.temp2) });
                    }
                    if (data.temp3 !== null) {
                      tempPoints.push({ x: xPos3, y: tempToY(data.temp3) });
                    }
                  });

                  const airTempPoints: Array<{ x: number; y: number }> = [];
                  graphData.forEach((data, index) => {
                    if (data.airTemp !== null) {
                      const colWidth = columnWidths[index];
                      const colStart = graphPadding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
                      const xPosAir = colStart + colWidth / 2;
                      airTempPoints.push({ x: xPosAir, y: tempToY(data.airTemp) });
                    }
                  });

                  return (
                    <>
                      {tempPoints.map((point, index) => {
                        if (index === 0) return null;
                        const prevPoint = tempPoints[index - 1];
                        return (
                          <line
                            key={`temp-line-${index}`}
                            x1={prevPoint.x}
                            y1={prevPoint.y}
                            x2={point.x}
                            y2={point.y}
                            stroke="#f97316"
                            strokeWidth={2}
                          />
                        );
                      })}

                      {airTempPoints.map((point, index) => {
                        if (index === 0) return null;
                        const prevPoint = airTempPoints[index - 1];
                        return (
                          <line
                            key={`air-line-${index}`}
                            x1={prevPoint.x}
                            y1={prevPoint.y}
                            x2={point.x}
                            y2={point.y}
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                          />
                        );
                      })}
                    </>
                  );
                })()}

                {graphData.map((data, index) => {
                  const colWidth = columnWidths[index];
                  const colStart = graphPadding.left + columnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
                  const xPos1 = colStart + colWidth * 0.25;
                  const xPos2 = colStart + colWidth * 0.5;
                  const xPos3 = colStart + colWidth * 0.75;
                  const xPosAir = colStart + colWidth / 2;

                  return (
                    <g key={`points-${data.dayNumber}`}>
                      {data.temp1 !== null && (
                        <circle
                          cx={xPos1}
                          cy={tempToY(data.temp1)}
                          r={4}
                          fill="#ea580c"
                          stroke="white"
                          strokeWidth={1}
                        />
                      )}

                      {data.temp2 !== null && (
                        <circle
                          cx={xPos2}
                          cy={tempToY(data.temp2)}
                          r={4}
                          fill="#fb923c"
                          stroke="white"
                          strokeWidth={1}
                        />
                      )}

                      {data.temp3 !== null && (
                        <circle
                          cx={xPos3}
                          cy={tempToY(data.temp3)}
                          r={4}
                          fill="#fed7aa"
                          stroke="white"
                          strokeWidth={1}
                        />
                      )}

                      {data.airTemp !== null && (
                        <circle
                          cx={xPosAir}
                          cy={tempToY(data.airTemp)}
                          r={4}
                          fill="#ef4444"
                          stroke="white"
                          strokeWidth={1}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-xs border-collapse">
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
                      {formatShortDate(new Date(record.recordDate))}
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
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">品温③(午後)</td>
                  {localRecords.map((record) => (
                    <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={record.temperature3 ?? ''}
                        onChange={(e) => updateRecord(record.dayNumber, { 
                          temperature3: e.target.value ? parseFloat(e.target.value) : null 
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
                    const dateKey = dateToKey(new Date(record.recordDate));
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
                  <td className="border border-slate-300 px-2 py-2 font-bold sticky left-0 bg-white z-10">ボーメ予測</td>
                  {(() => {
                    const savedSettings = localStorage.getItem('shubo_analysis_settings');
                    const settings = savedSettings ? JSON.parse(savedSettings) : null;
                    const predictionSettings = settings?.baumePrediction;
                    
                    const recordsWithBaume = localRecords.filter(r => r.baume !== null && r.dayNumber >= 3);
                    const lastTwoRecords = recordsWithBaume.slice(-2);
                    
                    let dailyChange: number | null = null;
                    let lastRecordDay: number | null = null;
                    let lastBaumeValue: number | null = null;
                    
                    if (lastTwoRecords.length === 2) {
                      const [prev, last] = lastTwoRecords;
                      const dayDiff = last.dayNumber - prev.dayNumber;
                      const baumeDiff = last.baume! - prev.baume!;
                      dailyChange = baumeDiff / dayDiff;
                      lastRecordDay = last.dayNumber;
                      lastBaumeValue = last.baume!;
                    }
                    
                    const isDual = shubo.primaryNumber !== shubo.secondaryNumber;
                    const maxDay = shubo.maxShuboDays;
                    
                    return localRecords.map((record) => {
                      let displayValue: string = '';
                      let textColor: string = '';
                      
                      if (record.baume !== null) {
                        displayValue = record.baume.toFixed(1);
                        const daysBeforeDischarge = maxDay - record.dayNumber;
                        const baumeValue = record.baume;
                        
                        // 実測値でも警告判定を行う
                        if (predictionSettings) {
                          if (daysBeforeDischarge === 0) {
                            textColor = 'text-red-600 font-semibold';
                          } else if (isDual) {
                            if (daysBeforeDischarge === 1 && predictionSettings.dual.daysBeforeDischarge1 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 2 && predictionSettings.dual.daysBeforeDischarge2 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 3 && predictionSettings.dual.daysBeforeDischarge3 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 4) {
                              if (baumeValue <= predictionSettings.dual.daysBeforeDischarge4Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.dual.daysBeforeDischarge4High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 5) {
                              if (baumeValue <= predictionSettings.dual.daysBeforeDischarge5Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.dual.daysBeforeDischarge5High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 6) {
                              if (baumeValue <= predictionSettings.dual.daysBeforeDischarge6Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.dual.daysBeforeDischarge6High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else {
                              textColor = 'text-blue-600 font-semibold';
                            }
                          } else {
                            if (daysBeforeDischarge === 1 && predictionSettings.single.daysBeforeDischarge1 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 2) {
                              if (baumeValue <= predictionSettings.single.daysBeforeDischarge2Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.single.daysBeforeDischarge2High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 3) {
                              if (baumeValue <= predictionSettings.single.daysBeforeDischarge3Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.single.daysBeforeDischarge3High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 4) {
                              if (baumeValue <= predictionSettings.single.daysBeforeDischarge4Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.single.daysBeforeDischarge4High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 5) {
                              if (baumeValue <= predictionSettings.single.daysBeforeDischarge5Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (baumeValue <= predictionSettings.single.daysBeforeDischarge5High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-blue-600 font-semibold';
                              }
                            } else {
                              textColor = 'text-blue-600 font-semibold';
                            }
                          }
                        } else {
                          textColor = 'text-blue-600 font-semibold';
                        }
                      } else if (dailyChange !== null && lastRecordDay !== null && lastBaumeValue !== null && record.dayNumber > lastRecordDay) {
                        const daysSinceLastRecord = record.dayNumber - lastRecordDay;
                        const predictedValue = lastBaumeValue + (dailyChange * daysSinceLastRecord);
                        displayValue = predictedValue.toFixed(1);
                        
                        const daysBeforeDischarge = maxDay - record.dayNumber;
                        
                        if (predictionSettings) {
                          if (daysBeforeDischarge === 0) {
                            textColor = 'text-red-600 font-semibold';
                          } else if (isDual) {
                            if (daysBeforeDischarge === 1 && predictionSettings.dual.daysBeforeDischarge1 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 2 && predictionSettings.dual.daysBeforeDischarge2 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 3 && predictionSettings.dual.daysBeforeDischarge3 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 4) {
                              if (predictedValue <= predictionSettings.dual.daysBeforeDischarge4Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.dual.daysBeforeDischarge4High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 5) {
                              if (predictedValue <= predictionSettings.dual.daysBeforeDischarge5Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.dual.daysBeforeDischarge5High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 6) {
                              if (predictedValue <= predictionSettings.dual.daysBeforeDischarge6Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.dual.daysBeforeDischarge6High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else {
                              textColor = 'text-green-600 font-semibold';
                            }
                          } else {
                            if (daysBeforeDischarge === 1 && predictionSettings.single.daysBeforeDischarge1 === null) {
                              textColor = 'text-red-600 font-semibold';
                            } else if (daysBeforeDischarge === 2) {
                              if (predictedValue <= predictionSettings.single.daysBeforeDischarge2Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.single.daysBeforeDischarge2High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 3) {
                              if (predictedValue <= predictionSettings.single.daysBeforeDischarge3Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.single.daysBeforeDischarge3High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 4) {
                              if (predictedValue <= predictionSettings.single.daysBeforeDischarge4Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.single.daysBeforeDischarge4High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else if (daysBeforeDischarge === 5) {
                              if (predictedValue <= predictionSettings.single.daysBeforeDischarge5Low) {
                                textColor = 'text-red-600 font-semibold';
                              } else if (predictedValue <= predictionSettings.single.daysBeforeDischarge5High) {
                                textColor = 'text-orange-600 font-semibold';
                              } else {
                                textColor = 'text-green-600 font-semibold';
                              }
                            } else {
                              textColor = 'text-green-600 font-semibold';
                            }
                          }
                        } else {
                          textColor = 'text-green-600 font-semibold';
                        }
                      }
                      
                      return (
                        <td key={record.dayNumber} className="border border-slate-300 px-2 py-2 text-center">
                          <span className={textColor}>{displayValue}</span>
                        </td>
                      );
                    });
                  })()}
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