import React, { useState } from 'react';
import type { TankConfigData } from '../utils/types';

interface TankSettingsProps {
  dataContext: {
    tankConfigData: TankConfigData[];
    updateTankConfig: (tankId: string, updates: Partial<TankConfigData>) => void;
    getRecommendedTanks: () => TankConfigData[];
  };
  onBack: () => void;
}

type SortType = 'capacity' | 'number';

export default function TankSettings({ dataContext, onBack }: TankSettingsProps) {
  const [sortType, setSortType] = useState<SortType>('capacity');

  const recommendedTanks = dataContext.getRecommendedTanks();
  const otherTanks = dataContext.tankConfigData.filter(tank => !tank.isRecommended);

  function sortTanks(tanks: TankConfigData[]): TankConfigData[] {
    if (sortType === 'capacity') {
      return [...tanks].sort((a, b) => a.maxCapacity - b.maxCapacity);
    } else {
      return [...tanks].sort((a, b) => {
        const aNum = parseInt(a.tankId.replace('No.', '').replace('NO.', ''));
        const bNum = parseInt(b.tankId.replace('No.', '').replace('NO.', ''));
        return aNum - bNum;
      });
    }
  }

  function handleToggle(tankId: string, currentEnabled: boolean) {
    dataContext.updateTankConfig(tankId, { isEnabled: !currentEnabled });
  }

  const sortedRecommendedTanks = sortTanks(recommendedTanks);
  const sortedOtherTanks = sortTanks(otherTanks);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">タンク設定</h2>
              <p className="text-slate-600">タンクの有効/無効を切り替えます</p>
            </div>
            <button
              onClick={onBack}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-6 py-2 rounded-xl"
            >
              戻る
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-slate-700 font-semibold">並び順:</span>
            <button
              onClick={() => setSortType('capacity')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                sortType === 'capacity'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              容量順
            </button>
            <button
              onClick={() => setSortType('number')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                sortType === 'number'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              番号順
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden mb-6">
          <div className="bg-blue-800 px-6 py-4">
            <h3 className="text-xl font-bold text-white">推奨酒母タンク（{recommendedTanks.length}個）</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="px-4 py-3 text-left text-sm font-bold">タンクID</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">容量</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">状態</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">有効/無効</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecommendedTanks.map((tank, index) => (
                  <tr key={tank.tankId} className={`border-b hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 font-bold text-slate-800">{tank.tankId}</td>
                    <td className="px-4 py-3 text-slate-700">{tank.maxCapacity}L</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                        推奨
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(tank.tankId, tank.isEnabled)}
                        className={`w-16 h-8 rounded-full transition-colors ${
                          tank.isEnabled ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                          tank.isEnabled ? 'translate-x-9' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-slate-700 px-6 py-4">
            <h3 className="text-xl font-bold text-white">その他タンク（{otherTanks.length}個）</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="px-4 py-3 text-left text-sm font-bold">タンクID</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">容量</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">有効/無効</th>
                </tr>
              </thead>
              <tbody>
                {sortedOtherTanks.map((tank, index) => (
                  <tr key={tank.tankId} className={`border-b hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 font-bold text-slate-800">{tank.tankId}</td>
                    <td className="px-4 py-3 text-slate-700">{tank.maxCapacity}L</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(tank.tankId, tank.isEnabled)}
                        className={`w-16 h-8 rounded-full transition-colors ${
                          tank.isEnabled ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                          tank.isEnabled ? 'translate-x-9' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}