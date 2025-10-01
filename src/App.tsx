import { useState } from 'react'; 
import Dashboard from './components/Dashboard';
import TankAssignment from './components/TankAssignment';
import TankSettings from './components/TankSettings';
import { useData } from './hooks/useData';
import CSVUpdate from './components/CSVUpdate';
import AnalysisSettings from './components/AnalysisSettings';

type Page = 'dashboard' | 'tank-assignment' | 'tank-settings' | 'analysis-settings' | 'csv-update';

export default function App() {
  const dataContext = useData();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ナビゲーションバー */}
      <nav className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">🍶 酒母管理システム</h1>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                  currentPage === 'dashboard'
                    ? 'bg-white text-blue-700 shadow-lg'
                    : 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                }`}
              >
                📊 ダッシュボード
              </button>
              <button
                onClick={() => setCurrentPage('tank-assignment')}
                className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                  currentPage === 'tank-assignment'
                    ? 'bg-white text-blue-700 shadow-lg'
                    : 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                }`}
              >
                📊 タンク割り当て
              </button>
              <button
                onClick={() => setCurrentPage('analysis-settings')}
                className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                  currentPage === 'analysis-settings'
                    ? 'bg-white text-blue-700 shadow-lg'
                    : 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                }`}
              >
                📋 分析日設定
              </button>
              <button
                onClick={() => setCurrentPage('csv-update')}
                className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                  currentPage === 'csv-update'
                    ? 'bg-white text-blue-700 shadow-lg'
                    : 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                }`}
              >
                🔄 CSV更新
              </button>
              <button
                onClick={() => setCurrentPage('tank-settings')}
                className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-200 ${
                  currentPage === 'tank-settings'
                    ? 'bg-white text-blue-700 shadow-lg'
                    : 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                }`}
              >
                ⚙️ タンク設定
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main>
        {currentPage === 'dashboard' && (
          <Dashboard dataContext={dataContext} />
        )}
        {currentPage === 'tank-assignment' && (
          <TankAssignment 
            dataContext={dataContext}
            onTankSettings={() => setCurrentPage('tank-settings')}
          />
        )}
        {currentPage === 'tank-settings' && (
          <TankSettings 
            dataContext={dataContext}
            onBack={() => setCurrentPage('tank-assignment')}
          />
        )}
         {currentPage === 'analysis-settings' && (
        <AnalysisSettings onClose={() => setCurrentPage('dashboard')} />
      )}
       {currentPage === 'csv-update' && (
        <CSVUpdate dataContext={dataContext} onClose={() => setCurrentPage('dashboard')} />
      )}
      </main>
    </div>
  );
}