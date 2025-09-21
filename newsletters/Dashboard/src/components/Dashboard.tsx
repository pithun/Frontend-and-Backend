import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Map from "./Map";
import ThreatList from "./ThreatList";
import ThreatForm from "./ThreatForm";
import RoleManager from "./RoleManager";
import ThreatFilters from "./ThreatFilters";

import { useState, useMemo } from "react";

export default function Dashboard() {
  const threats = useQuery(api.threats.listThreats) || [];
  const userRole = useQuery(api.threats.getUserRole);
  const [showForm, setShowForm] = useState(false);
  const [editingThreat, setEditingThreat] = useState<any>(null);
  const [filters, setFilters] = useState({
    state: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const isAdmin = userRole === "admin";

  // Get unique states for filter dropdown
  const availableStates = useMemo(() => {
    const states = [...new Set(threats.map(t => t.state))].filter(Boolean);
    return states.sort();
  }, [threats]);

  // Filter threats based on current filters
  const filteredThreats = useMemo(() => {
    return threats.filter(threat => {
      // State filter
      if (filters.state && threat.state !== filters.state) {
        return false;
      }

      // Status filter
      if (filters.status && threat.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        const incidentDate = threat.incidentDate;
        if (!incidentDate) return false;

        if (filters.dateFrom && incidentDate < filters.dateFrom) {
          return false;
        }

        if (filters.dateTo && incidentDate > filters.dateTo) {
          return false;
        }
      }

      return true;
    });
  }, [threats, filters]);

  // Get threat statistics for filtered data
  const threatStats = {
    total: filteredThreats.length,
    high: filteredThreats.filter(t => t.status === "High").length,
    medium: filteredThreats.filter(t => t.status === "Medium").length,
    low: filteredThreats.filter(t => t.status === "Low").length,
    resolved: filteredThreats.filter(t => t.status === "Resolved").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Threat Dashboard</h1>
          <p className="text-gray-600">
            Role: <span className="font-semibold capitalize">{userRole}</span>
            {filteredThreats.length !== threats.length && (
              <span className="ml-2 text-sm">
                (Showing {filteredThreats.length} of {threats.length} threats)
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Report New Threat
          </button>
        )}
      </div>

      {/* Filters */}
      <ThreatFilters
        onFiltersChange={setFilters}
        availableStates={availableStates}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{threatStats.total}</div>
          <div className="text-sm text-gray-600">Total Threats</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-red-600">{threatStats.high}</div>
          <div className="text-sm text-gray-600">High Priority</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-orange-600">{threatStats.medium}</div>
          <div className="text-sm text-gray-600">Medium Priority</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-yellow-600">{threatStats.low}</div>
          <div className="text-sm text-gray-600">Low Priority</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">{threatStats.resolved}</div>
          <div className="text-sm text-gray-600">Resolved</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Threat Map</h2>
            <p className="text-sm text-gray-600">Real-time visualization of security threats</p>
          </div>
          <div className="p-4">
            <Map threats={filteredThreats} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Threats</h2>
            <p className="text-sm text-gray-600">Latest reported security incidents</p>
          </div>
          <div className="p-4">
            <ThreatList 
              threats={filteredThreats} 
              isAdmin={isAdmin}
              onEdit={(threat) => {
                setEditingThreat(threat);
                setShowForm(true);
              }}
            />
          </div>
        </div>
      </div>

      {showForm && (
        <ThreatForm
          threat={editingThreat}
          onClose={() => {
            setShowForm(false);
            setEditingThreat(null);
          }}
        />
      )}

      <RoleManager />
    </div>
  );
}
