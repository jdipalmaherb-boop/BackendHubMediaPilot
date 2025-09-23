import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalSpend: 0,
    totalConversions: 0,
    averageROAS: 0,
    averageCPA: 0
  })

  const [trends, setTrends] = useState([])
  const [insights, setInsights] = useState([])
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    // TODO: Fetch data from backend
    // This would involve calling the dashboard API endpoints
    setMetrics({
      totalSpend: 5000,
      totalConversions: 500,
      averageROAS: 2.3,
      averageCPA: 12.0
    })

    setTrends([
      { date: '2023-10-01', roas: 2.1, cpa: 15.0, spend: 1000 },
      { date: '2023-10-02', roas: 2.3, cpa: 14.0, spend: 1200 },
      { date: '2023-10-03', roas: 2.5, cpa: 13.0, spend: 1100 },
      { date: '2023-10-04', roas: 2.4, cpa: 12.5, spend: 1300 },
      { date: '2023-10-05', roas: 2.6, cpa: 11.0, spend: 1400 }
    ])

    setInsights([
      { type: 'success', message: 'Campaign A is performing 20% above target ROAS' },
      { type: 'warning', message: 'Campaign B has high CPA, consider pausing' },
      { type: 'info', message: 'New creative variations ready for testing' }
    ])

    setAlerts([
      { type: 'high_cpa', message: 'Campaign B CPA exceeded threshold', severity: 'high' },
      { type: 'budget_exhaustion', message: 'Campaign A budget 80% exhausted', severity: 'medium' }
    ])
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Spend</p>
              <p className="text-2xl font-semibold text-gray-900">${metrics.totalSpend.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Conversions</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.totalConversions.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average ROAS</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.averageROAS}x</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average CPA</p>
              <p className="text-2xl font-semibold text-gray-900">${metrics.averageCPA}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends Chart */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="roas" stroke="#3b82f6" strokeWidth={2} />
            <Line type="monotone" dataKey="cpa" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insights and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Insights</h2>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
                <p className="text-sm text-gray-700">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3" />
                <p className="text-sm text-gray-700">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard



