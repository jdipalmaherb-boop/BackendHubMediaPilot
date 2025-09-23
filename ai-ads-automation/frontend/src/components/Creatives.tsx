import React, { useState, useEffect } from 'react'
import { Plus, Play, Pause, Edit, Trash2, Image, Video } from 'lucide-react'

const Creatives = () => {
  const [creatives, setCreatives] = useState([])

  useEffect(() => {
    // TODO: Fetch creatives from backend
    setCreatives([
      {
        id: 1,
        name: 'Summer Sale Creative A',
        type: 'image',
        status: 'active',
        ctr: 0.05,
        cpm: 10.0,
        conversions: 45,
        mediaUrl: 'https://example.com/creative1.jpg'
      },
      {
        id: 2,
        name: 'Holiday Video Creative',
        type: 'video',
        status: 'paused',
        ctr: 0.03,
        cpm: 15.0,
        conversions: 23,
        mediaUrl: 'https://example.com/creative2.mp4'
      }
    ])
  }, [])

  const handleStatusToggle = (creativeId: number) => {
    setCreatives(creatives.map(creative => 
      creative.id === creativeId 
        ? { ...creative, status: creative.status === 'active' ? 'paused' : 'active' }
        : creative
    ))
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Creatives</h1>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          New Creative
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {creatives.map((creative) => (
          <div key={creative.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="aspect-video bg-gray-200 flex items-center justify-center">
              {creative.type === 'image' ? (
                <Image className="h-12 w-12 text-gray-400" />
              ) : (
                <Video className="h-12 w-12 text-gray-400" />
              )}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{creative.name}</h3>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  creative.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {creative.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-medium">CTR</p>
                  <p>{(creative.ctr * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="font-medium">CPM</p>
                  <p>${creative.cpm}</p>
                </div>
                <div>
                  <p className="font-medium">Conversions</p>
                  <p>{creative.conversions}</p>
                </div>
                <div>
                  <p className="font-medium">Type</p>
                  <p className="capitalize">{creative.type}</p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => handleStatusToggle(creative.id)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  {creative.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button className="text-indigo-600 hover:text-indigo-900">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="text-red-600 hover:text-red-900">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Creatives



