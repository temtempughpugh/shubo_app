import React from 'react';
import TankAssignment from './components/TankAssignment';
import { useData } from './hooks/useData';

export default function App() {
  const dataContext = useData(); // この行が必要

  // 読み込み中
  if (dataContext.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // 読み込みエラー
  if (dataContext.loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">データ読み込みエラー</h2>
          <p className="text-gray-600 mb-4">{dataContext.loadError}</p>
          <button 
            onClick={dataContext.reloadData}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // メイン画面
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white p-4">
        <div className="container mx-auto">
          <h1 className="text-xl font-bold">酒母管理システム - タンク割り当て</h1>
          <p className="text-blue-200 text-sm">動作確認用</p>
        </div>
      </header>
      
      <main className="container mx-auto p-6">
        <TankAssignment dataContext={dataContext} />
      </main>
      
      <footer className="bg-gray-800 text-white p-4 mt-8">
        <div className="container mx-auto text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="font-semibold">酒母データ:</span> {dataContext.shuboRawData.length}件
            </div>
            <div>
              <span className="font-semibold">レシピデータ:</span> {dataContext.recipeRawData.length}件
            </div>
            <div>
              <span className="font-semibold">タンクデータ:</span> {dataContext.tankConversionMap.size}個
            </div>
            <div>
              <span className="font-semibold">設定済み:</span> {dataContext.configuredShuboData.length}件
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}