const mongoose = require("mongoose");

const Plan = require("../models/Plan");

const hasManagementAccess = (user) => ["admin", "leader"].includes(user.systemRole); // Check if the user has management access (admin or leader)

const canModifyPlan = (user, plan) => user.systemRole === "admin" || plan.createdBy.toString() === user._id.toString(); // Check if the user can modify the plan (admin)

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Controller functions for managing marketing plans
const createPlan = async (req, res) => {
    try {
        if (!hasManagementAccess(req.user)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to create plans",
            });
        }

        const {
            name,
            description,
            targetAudience,
            pitch,
            followUpSteps,
            status, } = req.body;

        if (!name?.trim() || !description?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Plan name and description are required",
            });
        }

        if (followUpSteps !== undefined && !Array.isArray(followUpSteps)) {
            return res.status(400).json({
                success: false,
                message: "Follow-up steps must be an array",
            });
        }

        const plan = await Plan.create({
            name: name.trim(),
            description: description.trim(),
            targetAudience: targetAudience?.trim() || "",
            pitch: pitch?.trim() || "",
            followUpSteps: followUpSteps?.map((step) => typeof step === "string" ? step.trim() : "").filter(Boolean) || [],
            status: status || "draft",
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });

        await plan.populate([
            {
                path: "createdBy",
                select: "name email systemRole",
            },
            {
                path: "updatedBy",
                select: "name email systemRole",
            },
        ]);

        return res.status(201).json({
            success: true,
            message: "Marketing plan created successfully",
            plan,
        });
    } catch (error) {
        console.error("Create plan error:", error);

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors)[0]?.message || "Invalid plan data",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to create marketing plan",
        });
    }
};

// Get all plans with optional filtering, searching and pagination
const getPlans = async (req, res) => {
    try {
        const {
            status,
            search,
            page = 1,
            limit = 10, } = req.query;

        const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);

        const query = {};

        if (req.user.systemRole === "member") {
            query.status = "active";
        } else if (status && ["draft", "active", "archived"].includes(status)) {
            query.status = status;
        }

        if (search?.trim()) {
            const safeSearch = escapeRegex(search.trim());

            query.$or = [
                {
                    name: {
                        $regex: safeSearch,
                        $options: "i",
                    },
                },
                {
                    description: {
                        $regex: safeSearch,
                        $options: "i",
                    },
                },
                {
                    targetAudience: {
                        $regex: safeSearch,
                        $options: "i",
                    },
                },
            ];
        }

        const skip = (pageNumber - 1) * pageSize;

        const [plans, totalPlans] = await Promise.all([
            Plan.find(query)
                .populate(
                    "createdBy",
                    "name email systemRole"
                )
                .populate(
                    "updatedBy",
                    "name email systemRole"
                )
                .sort({ createdAt: -1 }).skip(skip).limit(pageSize),

            Plan.countDocuments(query),
        ]); // Get the total count of plans matching the query

        return res.status(200).json({
            success: true,
            count: plans.length,
            total: totalPlans,
            page: pageNumber,
            totalPages: Math.ceil(totalPlans / pageSize),
            plans,
        });
    } catch (error) {
        console.error("Get plans error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve marketing plans",
        });
    }
};

// Get a specific plan by ID
const getPlanById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan ID",
            });
        }

        const plan = await Plan.findById(req.params.id)
            .populate(
                "createdBy",
                "name email systemRole"
            )
            .populate(
                "updatedBy",
                "name email systemRole"
            );

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Marketing plan not found",
            });
        }

        if (req.user.systemRole === "member" && plan.status !== "active") {
            return res.status(404).json({
                success: false,
                message: "Marketing plan not found",
            });
        }

        return res.status(200).json({
            success: true,
            plan,
        });
    } catch (error) {
        console.error("Get plan error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve marketing plan",
        });
    }
};

// Update a specific plan by ID
const updatePlan = async (req, res) => {
    try {
        if (!hasManagementAccess(req.user)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update plans",
            });
        }

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan ID",
            });
        }

        const plan = await Plan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Marketing plan not found",
            });
        }

        if (!canModifyPlan(req.user, plan)) {
            return res.status(403).json({
                success: false,
                message: "You can only modify plans created by you",
            });
        }

        const allowedFields = [
            "name",
            "description",
            "targetAudience",
            "pitch",
            "followUpSteps",
            "status",];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                plan[field] = req.body[field];
            }
        });

        plan.updatedBy = req.user._id;

        await plan.save();

        await plan.populate([
            {
                path: "createdBy",
                select: "name email systemRole",
            },
            {
                path: "updatedBy",
                select: "name email systemRole",
            },
        ]);

        return res.status(200).json({
            success: true,
            message: "Marketing plan updated successfully",
            plan,
        });
    } catch (error) {
        console.error("Update plan error:", error);

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors)[0]?.message || "Invalid plan data",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to update marketing plan",
        });
    }
};

// Delete (archive) a specific plan by ID
const deletePlan = async (req, res) => {
    try {
        if (!hasManagementAccess(req.user)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to archive plans",
            });
        }

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan ID",
            });
        }

        const plan = await Plan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Marketing plan not found",
            });
        }

        if (!canModifyPlan(req.user, plan)) {
            return res.status(403).json({
                success: false,
                message: "You can only archive plans created by you",
            });
        }

        if (plan.status === "archived") {
            return res.status(400).json({
                success: false,
                message: "Marketing plan is already archived",
            });
        }

        plan.status = "archived";
        plan.updatedBy = req.user._id;

        await plan.save();

        return res.status(200).json({
            success: true,
            message: "Marketing plan archived successfully",
        });
    } catch (error) {
        console.error("Archive plan error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to archive marketing plan",
        });
    }
};

module.exports = {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
};
