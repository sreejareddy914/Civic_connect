
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
  location: { lat: number; lng: number } | null;
  onLocationSelect: (lat: number, lng: number) => void;
}

function LocationMarker({ location, onLocationSelect }: MapPickerProps) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return location === null ? null : (
    <Marker position={[location.lat, location.lng]} />
  );
}

export default function MapPicker({ location, onLocationSelect }: MapPickerProps) {
  const defaultCenter: [number, number] = [17.3850, 78.4867]; // Default to Hyderabad
  const center = location ? [location.lat, location.lng] : defaultCenter;

  return (
    <div className="h-64 w-full rounded-md overflow-hidden border border-gray-300 relative z-0">
      <MapContainer
        center={center as [number, number]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker location={location} onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
}
