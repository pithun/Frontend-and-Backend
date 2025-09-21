import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  threats: defineTable({
    title: v.string(),
    description: v.string(),
    state: v.string(),
    lga: v.string(),
    status: v.union(v.literal("High"), v.literal("Medium"), v.literal("Low"), v.literal("Resolved")),
    lat: v.number(),
    lng: v.number(),
    incidentDate: v.optional(v.string()),
    incidentTime: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_status", ["status"]),
  
  userRoles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("employee")),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
