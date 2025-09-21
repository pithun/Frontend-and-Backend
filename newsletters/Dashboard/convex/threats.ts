import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function getUserRoleInternal(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return userRole?.role || "employee";
}

export const listThreats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const threats = await ctx.db.query("threats").order("desc").collect();
    return threats;
  },
});

export const addThreat = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    state: v.string(),
    lga: v.string(),
    status: v.union(v.literal("High"), v.literal("Medium"), v.literal("Low"), v.literal("Resolved")),
    lat: v.number(),
    lng: v.number(),
    incidentDate: v.optional(v.string()),
    incidentTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const role = await getUserRoleInternal(ctx, userId);
    if (role !== "admin") {
      throw new Error("Only admins can add threats");
    }

    return await ctx.db.insert("threats", {
      ...args,
      createdBy: userId,
    });
  },
});

export const updateThreat = mutation({
  args: {
    id: v.id("threats"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    state: v.optional(v.string()),
    lga: v.optional(v.string()),
    status: v.optional(v.union(v.literal("High"), v.literal("Medium"), v.literal("Low"), v.literal("Resolved"))),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    incidentDate: v.optional(v.string()),
    incidentTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const role = await getUserRoleInternal(ctx, userId);
    if (role !== "admin") {
      throw new Error("Only admins can update threats");
    }

    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    return userRole?.role || "employee";
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("employee")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if user role already exists
    const existingRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingRole) {
      await ctx.db.patch(existingRole._id, { role: args.role });
    } else {
      await ctx.db.insert("userRoles", args);
    }
  },
});
