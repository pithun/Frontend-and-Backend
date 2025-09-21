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

interface ThreatListProps {
  threats: Threat[];
  isAdmin: boolean;
  onEdit: (threat: Threat) => void;
}

export default function ThreatList({ threats, isAdmin, onEdit }: ThreatListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "High": return "bg-red-100 text-red-800";
      case "Medium": return "bg-orange-100 text-orange-800";
      case "Low": return "bg-yellow-100 text-yellow-800";
      case "Resolved": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
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

  if (threats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No threats reported yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {threats.map((threat) => (
        <div key={threat._id} className="border rounded-lg p-4 hover:bg-gray-50">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900">{threat.title}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(threat.status)}`}>
              {threat.status}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mb-2">{threat.description}</p>
          
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>{threat.lga}, {threat.state}</span>
              <span className="font-medium text-gray-700">
                {formatDateTime(threat.incidentDate, threat.incidentTime)}
              </span>
            </div>
            {isAdmin && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => onEdit(threat)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
