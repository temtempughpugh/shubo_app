import React, { useState } from 'react';
import TankAssignment from './components/TankAssignment';
import TankSettings from './components/TankSettings';
import { useData } from './hooks/useData';

type Page = 'tank-assignment' | 'tank-settings';

export default function App() {
  const dataContext = useData();
  const [currentPage, setCurrentPage] = useState<Page>('tank-assignment');

  // 読み込み中
  if (dataContext.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <p className="text-slate-600 text-lg font-medium">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // 読み込みエラー
  if (dataContext.loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-md">
          <div className="text-red-500 text-7xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">データ読み込みエラー</h2>
          <p className="text-slate-600 mb-6">{dataContext.loadError}</p>
          <button 
            onClick={dataContext.reloadData}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // メイン画面
  if (currentPage === 'tank-settings') {
    return (
      <TankSettings 
        dataContext={dataContext}
        onBack={() => setCurrentPage('tank-assignment')}
      />
    );
  }

  return (
    <TankAssignment 
      dataContext={dataContext}
      onTankSettings={() => setCurrentPage('tank-settings')}
    />
  );
}