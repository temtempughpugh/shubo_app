type Page = 'dashboard' | 'tank-assignment' | 'tank-settings' | 'analysis-schedule';

interface NavigationProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export default function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as const, label: 'ダッシュボード', icon: '📊' },
    { id: 'tank-assignment' as const, label: 'タンク割り当て', icon: '🏭' },
    { id: 'tank-settings' as const, label: 'タンク設定', icon: '⚙️' },
    { id: 'analysis-schedule' as const, label: '採取日設定', icon: '📅' },
  ];

  return (
    <nav className="bg-blue-800 text-white p-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">酒母管理システム</h1>
          
          <div className="flex space-x-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-700 hover:bg-blue-600 text-blue-100'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}