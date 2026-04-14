import { useState } from 'react'
import MapView from './MapView'

export default function MainTab() {
  const [selectedId, setSelectedId] = useState(null)

  return (
    <div className="flex flex-col h-full">
      <MapView
        onMarkerClick={(id) => setSelectedId((prev) => (prev === id ? null : id))}
        selectedId={selectedId}
      />
    </div>
  )
}
