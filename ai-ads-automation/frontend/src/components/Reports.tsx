import React, { useState, useEffect } from 'react'
import { Download, FileText, Calendar, Filter } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const Reports = () => {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    // TODO: Fetch reports from backend
    setReports([
      {
        id: 1,
        name: 'Campaign Performance Report',
        type: 'campaign',
        dateRange: '2023-10-01 to 2023-10-31',
        status: 'completed',
        data: {
          summary: 'Campaign performing well with ROAS of 2.5',
          metrics: {
            roas: 2.5,
            cpa: 15.0,
            ctr: 0.05,
            cpm: 10.0
          },
          trends: [
            { date: '2023-10-01', roas: 2.1, cpa: 15.0, spend: 1000 },
            { date: '2023-10-02', roas: 2.3, cpa: 14.0, spend: 1200 },
            { date: '2023-10-03', roas: 2.5, cpa: 13.0, spend: 1100 },
            { date: '2023-10-04', roas: 2.4, cpa: 12.5, spend: 1300 },
            { date: '2023-10-05', roas: 2.6, cpa: 11.0, spend: 1400 }
          ]
        }
      },
      {
        id: 2,
        name: 'Portfolio Overview Report',
        type: 'portfolio',
        dateRange: '2023-10-01 to 2023-10-31',
        status: 'completed',
        data: {
          summary: 'Portfolio performing well with average ROAS of 2.3',
          metrics: {
            total_campaigns: 5,
            total_spend: 5000.0,
            total_conversions: 500,
            average_roas: 2.3,
            average_cpa: 12.0
          }
        }
      }
    ])
  }, [])

  const handleDownload = (reportId: number) => {
    // TODO: Implement download functionality
    console.log(`Downloading report ${reportId}`)
  }

  const handleView = (report: any) => {
    setSelectedReport(report)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <div className="flex space-x-2">
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter
          </button>
          <button className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Generate Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                <p className="text-sm text-gray-600">{report.dateRange}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleView(report)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDownload(report.id)}
                  className="text-green-600 hover:text-green-900"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Type: {report.type}</span>
              </div>
              <div className="flex items-center">
                <span className="font-medium">Status:</span>
                <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                  report.status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {report.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Viewer Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">{selectedReport.name}</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Summary</h3>
                <p className="text-gray-600">{selectedReport.data.summary}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(selectedReport.data.metrics).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 capitalize">
                        {key.replace('_', ' ')}
                      </p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReport.data.trends && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={selectedReport.data.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="roas" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="cpa" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports



