import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Users, Target } from 'lucide-react'

const Targeting = () => {
  const [audiences, setAudiences] = useState([])

  useEffect(() => {
    // TODO: Fetch audiences from backend
    setAudiences([
      {
        id: 1,
        name: 'Tech Enthusiasts',
        platform: 'Meta',
        size: 1500000,
        cpa: 15.0,
        roas: 2.5,
        criteria: {
          demographics: { age_min: 25, age_max: 45, gender: 'any' },
          interests: ['technology', 'marketing', 'AI'],
          locations: ['US', 'CA', 'UK']
        }
      },
      {
        id: 2,
        name: 'Holiday Shoppers',
        platform: 'Google',
        size: 800000,
        cpa: 22.0,
        roas: 1.8,
        criteria: {
          demographics: { age_min: 30, age_max: 55, gender: 'any' },
          interests: ['shopping', 'holidays', 'gifts'],
          locations: ['US']
        }
      }
    ])
  }, [])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Targeting & Audiences</h1>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          New Audience
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {audiences.map((audience) => (
          <div key={audience.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{audience.name}</h3>
                <p className="text-sm text-gray-600">{audience.platform} • {audience.size.toLocaleString()} people</p>
              </div>
              <div className="flex space-x-2">
                <button className="text-indigo-600 hover:text-indigo-900">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="text-red-600 hover:text-red-900">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center">
                <Target className="h-5 w-5 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600">CPA</p>
                  <p className="text-lg font-semibold text-gray-900">${audience.cpa}</p>
                </div>
              </div>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-green-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600">ROAS</p>
                  <p className="text-lg font-semibold text-gray-900">{audience.roas}x</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Targeting Criteria</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Age:</span> {audience.criteria.demographics.age_min}-{audience.criteria.demographics.age_max}
                </div>
                <div>
                  <span className="font-medium">Interests:</span> {audience.criteria.interests.join(', ')}
                </div>
                <div>
                  <span className="font-medium">Locations:</span> {audience.criteria.locations.join(', ')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Targeting



