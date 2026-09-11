// An in-memory dependency double for application-logic tests only.
// It is not a MongoDB, Mongoose, bcrypt, JWT, Google, or SMTP integration test.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const hidden = new Set([
    "password", "googleId", "tokenVersion", "emailVerificationToken",
    "emailVerificationExpires", "emailVerificationTarget", "emailVerificationPurpose",
    "emailVerificationSentAt", "passwordResetToken", "passwordResetExpires",
    "passwordResetEmail", "passwordResetSentAt",
]);
const copy = (value) => structuredClone(value);
const fakeHash = (password) => `test-hash:${Buffer.from(password).toString("base64")}`;
const equal = (a, b) => a instanceof Date || b instanceof Date
    ? a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    : a === b;

function matches(row, filter) {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === "$and") return expected.every((part) => matches(row, part));
        if (key === "$or") return expected.some((part) => matches(row, part));
        const value = row[key];
        if (expected === null) return value === null || value === undefined;
        if (expected && typeof expected === "object" && !(expected instanceof Date)) {
            return Object.entries(expected).every(([operator, operand]) => {
                if (operator === "$ne") return !equal(value, operand);
                if (operator === "$exists") return (value !== undefined) === operand;
                if (operator === "$gt") return value != null && value > operand;
                if (operator === "$lte") return value != null && value <= operand;
                throw new Error(`Unsupported test query operator: ${operator}`);
            });
        }
        return equal(value, expected);
    });
}

function document(row, selection = "", includeHidden = false) {
    if (!row) return null;
    const result = copy(row);
    const parts = selection.split(/\s+/);
    if (!includeHidden) {
        for (const key of hidden) if (!parts.includes(`+${key}`)) delete result[key];
    }
    for (const part of parts) if (part.startsWith("-")) delete result[part.slice(1)];
    Object.defineProperties(result, {
        populate: { value: async function () { return this; } },
        comparePassword: { value: async function (password) { return this.password === fakeHash(password); } },
    });
    return result;
}

class Query {
    constructor(operation) { this.operation = operation; this.selection = ""; }
    select(value) { this.selection += ` ${value}`; return this; }
    populate() { return this; }
    then(resolve, reject) {
        this.promise ??= Promise.resolve().then(() => document(this.operation(), this.selection));
        return this.promise.then(resolve, reject);
    }
}

function createUserDouble() {
    const rows = [];
    let sequence = 0;
    const defaults = {
        name: "Test Member", email: "member@example.test", isActive: true,
        isEmailVerified: false, tokenVersion: 0, systemRole: "member", rank: null,
        pendingEmail: null, profilePicture: "", emailVerifiedAt: null,
        emailVerificationToken: null, emailVerificationExpires: null,
        emailVerificationTarget: null, emailVerificationPurpose: null,
        emailVerificationSentAt: null, passwordResetToken: null,
        passwordResetExpires: null, passwordResetEmail: null, passwordResetSentAt: null,
    };
    function unique(candidate) {
        const conflict = rows.some((row) => row._id !== candidate._id &&
            (row.email === candidate.email ||
                (candidate.googleId !== undefined && row.googleId === candidate.googleId)));
        if (conflict) throw Object.assign(new Error("Duplicate identity"), { code: 11000 });
    }
    function seed(values = {}) {
        const row = { ...copy(defaults), _id: String(++sequence).padStart(24, "0"), ...copy(values) };
        unique(row);
        rows.push(row);
        return copy(row);
    }
    function mutate(filter, update, after) {
        const index = rows.findIndex((row) => matches(row, filter));
        if (index < 0) return null;
        const old = copy(rows[index]);
        const next = { ...copy(old), ...copy(update.$set || {}) };
        for (const [key, delta] of Object.entries(update.$inc || {})) next[key] = (next[key] ?? 0) + delta;
        unique(next);
        rows[index] = next;
        return copy(after ? next : old);
    }
    const User = {
        findOne: (filter) => new Query(() => copy(rows.find((row) => matches(row, filter)) || null)),
        findById: (id) => new Query(() => copy(rows.find((row) => row._id === id) || null)),
        findOneAndUpdate: (filter, update, options = {}) =>
            new Query(() => mutate(filter, update, options.returnDocument === "after")),
        updateOne: async (filter, update) => ({ matchedCount: mutate(filter, update, true) ? 1 : 0 }),
        create: async (values) => document(seed({
            ...values, ...(values.password ? { password: fakeHash(values.password) } : {}),
        }), "", true),
    };
    return { User, seed, row: (id) => rows.find((row) => row._id === id), rows };
}

function loadWithMocks(relativeFile, mocks, logs = []) {
    const filename = path.resolve(__dirname, "../..", relativeFile);
    const nativeRequire = createRequire(filename);
    const context = {
        module: { exports: {} }, exports: {}, process, Buffer, URL, Date,
        console: { error: (...args) => logs.push(args) },
        require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name),
    };
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
    return context.module.exports;
}

function harness({ sendEmail } = {}) {
    const db = createUserDouble();
    const emails = [];
    const logs = [];
    const issuedSessions = [];
    const google = { payload: null, error: null };
    const mail = sendEmail || (async (message) => { emails.push(message); });
    const generateToken = (id, version) => {
        const token = `test-session:${id}:${version}`;
        issuedSessions.push({ id, version, token });
        return token;
    };
    const controller = loadWithMocks("src/controllers/authController.js", {
        "../models/User": db.User,
        "../utils/sendEmail": mail,
        "../utils/generateToken": generateToken,
        bcryptjs: { hash: async (value) => fakeHash(value) },
        "google-auth-library": {
            OAuth2Client: class {
                async verifyIdToken() {
                    if (google.error) throw google.error;
                    return { getPayload: () => google.payload };
                }
            }
        },
    }, logs);
    const middleware = loadWithMocks("src/middleware/authMiddleware.js", {
        "../models/User": db.User,
        "../models/Rank": {},
        jsonwebtoken: {
            verify: (token) => {
                const [prefix, userId, version] = token.split(":");
                if (prefix !== "test-session") throw Object.assign(new Error("Invalid"), { name: "JsonWebTokenError" });
                return { userId, tokenVersion: Number(version) };
            }
        },
    }, logs);
    return { ...db, controller, middleware, emails, logs, issuedSessions, google, generateToken };
}

async function invoke(handler, { body = {}, params = {}, user, token } = {}) {
    const result = { status: 200, body: undefined, next: false };
    const res = {
        status(value) { result.status = value; return this; },
        json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; },
    };
    const req = { body, params, user, headers: token ? { authorization: `Bearer ${token}` } : {} };
    await handler(req, res, () => { result.next = true; });
    result.requestUser = req.user;
    return result;
}

function emailToken(message, kind = "verify") {
    const url = new URL(message.text.match(/https?:\/\/\S+/)[0]);
    return kind === "reset" ? url.pathname.split("/").at(-1) : new URLSearchParams(url.hash.slice(1)).get("token");
}

module.exports = { createUserDouble, harness, invoke, emailToken, fakeHash };
