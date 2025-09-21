import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export default function RoleManager() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const setUserRole = useMutation(api.threats.setUserRole);
  const [isSettingRole, setIsSettingRole] = useState(false);

  const handleSetRole = async (role: "admin" | "employee") => {
    if (!loggedInUser) return;
    
    setIsSettingRole(true);
    try {
      await setUserRole({
        userId: loggedInUser._id,
        role: role,
      });
      toast.success(`Role set to ${role}`);
    } catch (error) {
      toast.error("Failed to set role");
    } finally {
      setIsSettingRole(false);
    }
  };

  if (!loggedInUser) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border">
      <p className="text-sm text-gray-600 mb-2">Set your role for demo:</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleSetRole("admin")}
          disabled={isSettingRole}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
        >
          Admin
        </button>
        <button
          onClick={() => handleSetRole("employee")}
          disabled={isSettingRole}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Employee
        </button>
      </div>
    </div>
  );
}
