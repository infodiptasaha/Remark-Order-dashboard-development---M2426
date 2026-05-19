'use client'

import { useState } from 'react'
import MainDashboard from './components/MainDashboard'
import ComingSoon from './components/ComingSoon'

const NAV = [
  { id: 1, label: 'Order Dashboard', icon: '📦', items: null },
  {
    id: 2, label: 'Customer Behavior', icon: '👥',
    items: [
      'Recency / Frequency / Monetary',
      'Loyal vs At-Risk (Churn)',
      'Customer Lifetime Value (CLV)',
      'Repeat Purchase Rate',
    ]
  },
  {
    id: 3, label: 'Product & Sales', icon: '🛒',
    items: [
      'Top & Bottom Products',
      'Market Basket Analysis',
    ]
  },
  {
    id: 4, label: 'Time & Trends', icon: '📈',
    items: [
      'Seasonality & Trends',
      'Daily / Hourly Sales Peak',
    ]
  },
  {
    id: 5, label: 'Geographic', icon: '🗺️',
    items: [
      'Hotspots & Coldspots',
      'Product-Location Fit',
      'Heatmap',
    ]
  },
  {
    id: 6, label: 'Brand Analysis', icon: '🏷️',
    items: [
      'Brand Performance Metrics',
      'Order Volume',
      'Growth Rate (vs Prev Month)',
      'Repeat Purchase by Brand',
      'Brand Affinity',
      'Average Order Value',
      'Repeat Purchase Velocity',
      'Cohort Analysis',
      'Customer Churn Rate',
      'Switching Analysis',
    ]
  },
]

export default function Page() {
  const [activeNav, setActiveNav] = useState(1)
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activeParent = NAV.find(n => n.id === activeNav)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-12'} shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden`}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">R</div>
              <span className="text-xs font-semibold text-gray-800">RHBL Analytics</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 cursor-pointer shrink-0 ml-auto"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5">
          {NAV.map(nav => (
            <div key={nav.id}>
              <button
                onClick={() => { setActiveNav(nav.id); setActiveSub(null) }}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer
                  ${activeNav === nav.id && !activeSub ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="text-base shrink-0">{nav.icon}</span>
                {sidebarOpen && <span className="text-xs font-medium truncate">{nav.label}</span>}
                {sidebarOpen && nav.items && (
                  <span className="ml-auto text-[10px] text-gray-300">{activeNav === nav.id ? '▾' : '▸'}</span>
                )}
              </button>
              {sidebarOpen && nav.items && activeNav === nav.id && (
                <div className="ml-6 mt-0.5 space-y-0.5">
                  {nav.items.map(item => (
                    <button
                      key={item}
                      onClick={() => setActiveSub(item)}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer
                        ${activeSub === item ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="px-3 py-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Live · MongoDB</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {activeNav === 1
          ? <MainDashboard />
          : <ComingSoon
              section={activeParent?.label || ''}
              subItem={activeSub}
              icon={activeParent?.icon || ''}
            />
        }
      </div>
    </div>
  )
}
