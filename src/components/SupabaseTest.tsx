import { useSupabaseData } from '../hooks/useSupabaseData'

export default function SupabaseTest() {
  const { shuboRawData, setShuboRawData, isLoading, loadError, reloadData } = useSupabaseData()

  const handleAddTestData = async () => {
    const testData = {
      shuboNumber: 1,
      fiscalYear: 2024,
      brewingScale: 1200,
      pourDate: '',
      brewingCategory: '',
      tankNumber: 0,
      memo: 'テストデータ',
      kojiRiceVariety: '山田錦',
      kakeRiceVariety: '山田錦',
      shuboTotalRice: 70,
      shuboStartDate: '45200',
      shuboEndDate: '45210',
      shuboDays: 10,
      yeast: '901'
    }

    try {
      await setShuboRawData([testData])
      alert('テストデータを保存しました')
      reloadData()
    } catch (error) {
      alert('保存エラー: ' + error)
    }
  }

  if (isLoading) {
    return <div className="p-8">読み込み中...</div>
  }

  if (loadError) {
    return <div className="p-8 text-red-600">エラー: {loadError}</div>
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Supabase接続テスト</h1>
      
      <div className="space-y-2">
        <button
          onClick={handleAddTestData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          テストデータを追加
        </button>

        <button
          onClick={reloadData}
          className="ml-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          再読み込み
        </button>
      </div>

      <div className="border p-4 rounded">
        <h2 className="font-bold mb-2">取得データ: {shuboRawData.length}件</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(shuboRawData, null, 2)}
        </pre>
      </div>
    </div>
  )
}