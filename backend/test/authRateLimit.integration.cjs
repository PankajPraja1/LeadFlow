require("dotenv").config();

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");

const connectDB = require("../src/config/db");
const AuthRateLimit = require("../src/models/AuthRateLimit");

const {
    createRateLimiter,
    getNetworkKey,
} = require("../src/middleware/authRateLimit");

const scope = `test:${randomUUID()}`;
let clock = Date.now();

const makeLimiter = () =>
    createRateLimiter({
        scope,
        limit: 3,
        windowMs: 60_000,
        keyGenerator: () => "integration-client",
        now: () => clock,
    });

const invoke = async (limiter) => {
    const result = {
        status: null,
        headers: {},
        body: null,
    };

    const res = {
        set(name, value) {
            result.headers[name] = value;
            return this;
        },

        status(value) {
            result.status = value;
            return this;
        },

        json(value) {
            result.body = value;
            return this;
        },
    };

    await limiter({}, res, () => {
        result.status = 200;
    });

    return result;
};

const run = async () => {
    try {
        await connectDB();

        const local = {
            socket: {
                remoteAddress: "127.0.0.1",
            },
            headers: {
                "x-vercel-forwarded-for": "198.51.100.2",
            },
        };

        assert.equal(
            getNetworkKey(local, false),
            "ipv4:127.0.0.1"
        );

        assert.equal(
            getNetworkKey(local, true),
            "ipv4:198.51.100.2"
        );

        assert.throws(() =>
            getNetworkKey({ headers: {} }, true)
        );

        const network = (ip) =>
            getNetworkKey(
                {
                    socket: { remoteAddress: ip },
                    headers: {},
                },
                false
            );

        assert.equal(
            network("127.0.0.1"),
            network("::ffff:127.0.0.1")
        );

        assert.equal(
            network("2001:db8:1234:5600::1"),
            network("2001:db8:1234:56ff::2")
        );

        assert.notEqual(
            network("2001:db8:1234:5600::1"),
            network("2001:db8:1234:5700::1")
        );

        console.log("PASS: client IP handling and IPv6 grouping");

        const first = makeLimiter();
        const second = makeLimiter();

        const results = await Promise.all(
            Array.from({ length: 10 }, (_, index) =>
                invoke(index % 2 ? first : second)
            )
        );

        assert.equal(
            results.filter((result) => result.status === 200).length,
            3
        );

        assert.equal(
            results.filter((result) => result.status === 429).length,
            7
        );

        console.log(
            "PASS: shared MongoDB counter under concurrent requests"
        );

        const blocked = await invoke(makeLimiter());

        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers["Retry-After"]) >= 1);

        console.log(
            "PASS: a fresh middleware instance sees the existing limit"
        );

        clock += 60_000;

        assert.equal((await invoke(first)).status, 200);

        console.log(
            "PASS: a new window works without waiting for TTL cleanup"
        );

        await mongoose.disconnect();

        assert.equal((await invoke(first)).status, 503);

        console.log(
            "PASS: unavailable counter storage blocks the request"
        );

        await connectDB();

        assert.equal((await invoke(first)).status, 200);

        console.log("PASS: database reconnect works");
    } finally {
        try {
            await connectDB();
            await AuthRateLimit.deleteMany({ scope });
        } finally {
            await mongoose.disconnect();
        }
    }
};

run().catch((error) => {
    console.error("Rate-limit integration test failed", {
        name: error.name,
        code: error.code,
        expected: error.expected,
        actual: error.actual,
    });

    process.exitCode = 1;
});