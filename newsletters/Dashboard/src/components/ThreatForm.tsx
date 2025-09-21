import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface Threat {
  _id: Id<"threats">;
  title: string;
  description: string;
  state: string;
  lga: string;
  status: "High" | "Medium" | "Low" | "Resolved";
  lat: number;
  lng: number;
  incidentDate?: string;
  incidentTime?: string;
}

interface ThreatFormProps {
  threat?: Threat | null;
  onClose: () => void;
}

export default function ThreatForm({ threat, onClose }: ThreatFormProps) {
  // Get current date and time for defaults
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    title: threat?.title || "",
    description: threat?.description || "",
    state: threat?.state || "",
    lga: threat?.lga || "",
    status: threat?.status || "Medium" as const,
    lat: threat?.lat || 6.5244,
    lng: threat?.lng || 3.3792,
    incidentDate: threat?.incidentDate || currentDate,
    incidentTime: threat?.incidentTime || currentTime,
  });

  const addThreat = useMutation(api.threats.addThreat);
  const updateThreat = useMutation(api.threats.updateThreat);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize map when showMap becomes true
  useEffect(() => {
    if (!showMap || typeof window === "undefined") return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!mapRef.current || mapInstanceRef.current) return;

      // Initialize map centered on current location
      mapInstanceRef.current = L.map(mapRef.current).setView([formData.lat, formData.lng], 8);

      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);

      // Fix marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      // Add current location marker
      markerRef.current = L.marker([formData.lat, formData.lng]).addTo(mapInstanceRef.current);

      // Handle map clicks
      mapInstanceRef.current.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        setFormData(prev => ({ ...prev, lat, lng }));
        markerRef.current.setLatLng([lat, lng]);
        toast.success("Location updated! Click anywhere on the map to change.");
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMap]);

  // Update marker when coordinates change
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([formData.lat, formData.lng]);
      mapInstanceRef.current.setView([formData.lat, formData.lng], 8);
    }
  }, [formData.lat, formData.lng]);

  // Geocoding function
  const geocodeLocation = async () => {
    if (!formData.state || !formData.lga) {
      toast.error("Please enter both state and LGA first");
      return;
    }

    setIsGeocoding(true);
    try {
      const query = `${formData.lga}, ${formData.state}, Nigeria`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setFormData(prev => ({ ...prev, lat: parseFloat(lat), lng: parseFloat(lon) }));
        toast.success("Location found and updated!");
      } else {
        toast.error("Location not found. Please try a different search or use the map.");
      }
    } catch (error) {
      toast.error("Failed to find location");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (threat) {
        await updateThreat({
          id: threat._id,
          ...formData,
        });
        toast.success("Threat updated successfully");
      } else {
        await addThreat(formData);
        toast.success("Threat reported successfully");
      }
      onClose();
    } catch (error) {
      toast.error("Failed to save threat");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {threat ? "Update Threat" : "Report New Threat"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LGA
              </label>
              <input
                type="text"
                required
                value={formData.lga}
                onChange={(e) => setFormData({ ...formData, lga: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Incident Date & Time Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Incident Date & Time
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.incidentDate}
                  onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  required
                  value={formData.incidentTime}
                  onChange={(e) => setFormData({ ...formData, incidentTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={geocodeLocation}
                  disabled={isGeocoding}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isGeocoding ? "Finding..." : "Find Location"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {showMap ? "Hide Map" : "Show Map"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {showMap && (
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">
                  Click anywhere on the map to set the threat location
                </p>
                <div 
                  ref={mapRef} 
                  className="w-full h-64 rounded-lg border"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : (threat ? "Update" : "Report")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
