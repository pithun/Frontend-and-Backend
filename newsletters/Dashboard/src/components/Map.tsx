import { useEffect, useRef } from "react";
import { Id } from "../../convex/_generated/dataModel";

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

interface MapProps {
  threats: Threat[];
}

export default function Map({ threats }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initMap = async () => {
      // Dynamically import Leaflet
      const L = (await import("leaflet")).default;
      
      // Import CSS
      await import("leaflet/dist/leaflet.css");

      if (!mapRef.current || mapInstanceRef.current) return;

      // Initialize map centered on Nigeria
      mapInstanceRef.current = L.map(mapRef.current).setView([9.0765, 7.3986], 6);

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
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;

      // Clear existing markers
      markersRef.current.forEach(marker => {
        mapInstanceRef.current.removeLayer(marker);
      });
      markersRef.current = [];

      // Add new markers
      threats.forEach(threat => {
        const getMarkerColor = (status: string) => {
          switch (status) {
            case "High": return "red";
            case "Medium": return "orange";
            case "Low": return "yellow";
            case "Resolved": return "green";
            default: return "blue";
          }
        };

        const formatDateTime = (date?: string, time?: string) => {
          if (!date || !time) return "Date not specified";
          try {
            const dateTime = new Date(`${date}T${time}`);
            return dateTime.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          } catch {
            return `${date} ${time}`;
          }
        };

        const markerHtml = `
          <div style="
            background-color: ${getMarkerColor(threat.status)};
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: "custom-marker",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([threat.lat, threat.lng], { icon: customIcon })
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-sm">${threat.title}</h3>
              <p class="text-xs text-gray-600 mb-1">${threat.description}</p>
              <p class="text-xs"><strong>Location:</strong> ${threat.lga}, ${threat.state}</p>
              <p class="text-xs"><strong>Incident:</strong> ${formatDateTime(threat.incidentDate, threat.incidentTime)}</p>
              <p class="text-xs"><strong>Status:</strong> 
                <span class="px-1 py-0.5 rounded text-xs font-medium" style="
                  background-color: ${getMarkerColor(threat.status)}20;
                  color: ${getMarkerColor(threat.status)};
                ">${threat.status}</span>
              </p>
            </div>
          `)
          .addTo(mapInstanceRef.current);

        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [threats]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-96 rounded-lg border"
      style={{ minHeight: "400px" }}
    />
  );
}
