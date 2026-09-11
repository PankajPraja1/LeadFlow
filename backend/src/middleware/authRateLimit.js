const crypto = require("node:crypto");
const { isIP } = require("node:net");
const ipaddr = require("ipaddr.js");

const AuthRateLimit = require("../models/AuthRateLimit");

let indexPromise = null;

const ensureIndexes = () => {
    if (!indexPromise) {
        indexPromise = AuthRateLimit.createIndexes().catch((error) => {
            indexPromise = null;
            throw error;
        });
    }

    return indexPromise;
};

const getNetworkKey = (
    req,
    onVercel = process.env.VERCEL === "1"
) => {
    const value = onVercel
        ? req.headers["x-vercel-forwarded-for"]
        : req.socket?.remoteAddress;

    if (typeof value !== "string" || !isIP(value.trim())) {
        throw new Error("A valid client IP is unavailable");
    }

    const address = ipaddr.process(value.trim());

    if (address.kind() === "ipv4") {
        return `ipv4:${address.toString()}`;
    }

    // Group IPv6 clients by /56 network: the first seven bytes.
    const prefix = Buffer.from(
        address.toByteArray().slice(0, 7)
    );

    return `ipv6:${prefix.toString("hex")}/56`;
};

const createRateLimiter = ({
    scope,
    limit,
    windowMs,
    keyGenerator = getNetworkKey,
    now = Date.now,
}) => {
    if (
        typeof scope !== "string" ||
        !/^[a-z0-9:_-]{1,80}$/.test(scope) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        !Number.isSafeInteger(windowMs) ||
        windowMs < 1000
    ) {
        throw new Error("Invalid rate-limit configuration");
    }

    return async (req, res, next) => {
        res.set("Cache-Control", "no-store");

        try {
            const identity = keyGenerator(req);

            if (typeof identity !== "string" || !identity) {
                throw new Error("Rate-limit identity is unavailable");
            }

            const start = Math.floor(now() / windowMs) * windowMs;
            const resetAt = start + windowMs;

            const id = crypto
                .createHmac("sha256", process.env.JWT_SECRET)
                .update(
                    JSON.stringify([
                        "auth-rate-limit-v1",
                        scope,
                        identity,
                        start,
                    ])
                )
                .digest("hex");

            await ensureIndexes();

            const update = {
                $inc: {
                    hits: 1,
                },

                $setOnInsert: {
                    scope,

                    // Briefly retain windows for requests already in flight.
                    expiresAt: new Date(resetAt + 60_000),
                },
            };

            const options = {
                upsert: true,
                returnDocument: "after",
                setDefaultsOnInsert: false,
                maxTimeMS: 5000,
            };

            let counter;

            try {
                counter = await AuthRateLimit.findOneAndUpdate(
                    { _id: id },
                    update,
                    options
                ).lean();
            } catch (error) {
                // Concurrent first requests may compete to insert this _id.
                if (error.code !== 11000) {
                    throw error;
                }

                counter = await AuthRateLimit.findOneAndUpdate(
                    { _id: id },
                    update,
                    {
                        ...options,
                        upsert: false,
                    }
                ).lean();
            }

            if (
                !counter ||
                !Number.isSafeInteger(counter.hits) ||
                counter.hits < 1
            ) {
                throw new Error("Invalid rate-limit counter");
            }

            if (counter.hits > limit) {
                const retryAfter = Math.max(
                    1,
                    Math.ceil((resetAt - now()) / 1000)
                );

                res.set("Retry-After", String(retryAfter));

                return res.status(429).json({
                    success: false,
                    code: "RATE_LIMITED",
                    message:
                        `Too many requests. Try again in ${retryAfter} seconds.`,
                    retryAfter,
                });
            }
        } catch (error) {
            console.error("Authentication rate limit unavailable", {
                name: error?.name,
                code: error?.code,
            });

            return res.status(503).json({
                success: false,
                code: "RATE_LIMIT_UNAVAILABLE",
                message:
                    "Authentication is temporarily unavailable. Please try again shortly.",
            });
        }

        return next();
    };
};

const authRequestLimiter = createRateLimiter({
    scope: "auth:requests",
    limit: 60,
    windowMs: 15 * 60 * 1000,
});

const signInLimiter = createRateLimiter({
    scope: "auth:signin",
    limit: 20,
    windowMs: 15 * 60 * 1000,
});

const emailRequestLimiter = createRateLimiter({
    scope: "auth:email",
    limit: 10,
    windowMs: 60 * 60 * 1000,
});

const accountActionLimiter = createRateLimiter({
    scope: "auth:account",
    limit: 10,
    windowMs: 15 * 60 * 1000,

    keyGenerator: (req) => {
        if (!req.user?._id) {
            throw new Error("Authenticated user is required");
        }

        return `user:${req.user._id}`;
    },
});

module.exports = {
    authRequestLimiter,
    signInLimiter,
    emailRequestLimiter,
    accountActionLimiter,
    createRateLimiter,
    getNetworkKey,
};
