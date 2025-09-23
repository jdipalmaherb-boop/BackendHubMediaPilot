import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Campaigns from './components/Campaigns'
import Creatives from './components/Creatives'
import Targeting from './components/Targeting'
import Optimization from './components/Optimization'
import Reports from './components/Reports'
import Sidebar from './components/Sidebar'

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/creatives" element={<Creatives />} />
            <Route path="/targeting" element={<Targeting />} />
            <Route path="/optimization" element={<Optimization />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App



