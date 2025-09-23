import React, { useState, useEffect } from 'react'
import { Play, Pause, Settings, TrendingUp, AlertCircle } from 'lucide-react'

const Optimization = () => {
  const [optimizations, setOptimizations] = useState([])

  useEffect(() => {
    // TODO: Fetch optimization data from backend
    setOptimizations([
      {
        id: 1,
        campaignName: 'Summer Sale Campaign',
        status: 'running',
        lastOptimized: '2023-10-27T10:00:00Z',
        improvements: {
          roas: 0.2,
          cpa: -2.0,
          ctr: 0.01
        },
        nextOptimization: '2023-10-27T16:00:00Z'
      },
      {
        id: 2,
        campaignName: 'Holiday Promotion',
        status: 'paused',
        lastOptimized: '2023-10-26T14:30:00Z',
        improvements: {
          roas: 0.1,
          cpa: -1.5,
          ctr: 0.005
        },
        nextOptimization: null
      }
    ])
  }, [])

  const handleStatusToggle = (optimizationId: number) => {
    setOptimizations(optimizations.map(opt => 
      opt.id === optimizationId 
        ? { ...opt, status: opt.status === 'running' ? 'paused' : 'running' }
        : opt
    ))
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Optimization</h1>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Optimization Settings
        </button>
      </div>

      <div className="space-y-6">
        {optimizations.map((optimization) => (
          <div key={optimization.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{optimization.campaignName}</h3>
                <p className="text-sm text-gray-600">
                  Last optimized: {new Date(optimization.lastOptimized).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  optimization.status === 'running' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {optimization.status}
                </span>
                <button
                  onClick={() => handleStatusToggle(optimization.id)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  {optimization.status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600">ROAS Improvement</p>
                  <p className="text-lg font-semibold text-green-600">
                    +{optimization.improvements.roas.toFixed(1)}x
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600">CPA Change</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {optimization.improvements.cpa > 0 ? '+' : ''}{optimization.improvements.cpa.toFixed(1)}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-purple-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600">CTR Improvement</p>
                  <p className="text-lg font-semibold text-purple-600">
                    +{(optimization.improvements.ctr * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {optimization.nextOptimization && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">
                  Next optimization scheduled: {new Date(optimization.nextOptimization).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Optimization



