const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmailVerificationService } = require("../src/services/emailVerificationService");
const { hashToken, passwordError } = require("../src/utils/authValidation");
const { createUserDouble, harness, invoke, emailToken, fakeHash } = require("./support/authHarness.cjs");

// No real credentials, database connections, or outbound messages are used.
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "unit-test-client-id";
const password = "Test password 42!";
const credentials = (email = "member@example.test") => ({ email, password });

function serviceFixture(values = {}, sender) {
    const db = createUserDouble();
    const user = db.seed(values);
    const emails = [];
    let clock = new Date("2026-09-10T10:00:00Z");
    const service = createEmailVerificationService({
        User: db.User, now: () => new Date(clock),
        sendEmail: sender || (async (message) => { emails.push(message); }),
    });
    return { ...db, user, emails, service, advance: (ms) => { clock = new Date(clock.getTime() + ms); } };
}

test("registration creates a pending member and never issues a session", async () => {
    const h = harness();
    const result = await invoke(h.controller.register, {
        body: {
            ...credentials(" MEMBER@EXAMPLE.TEST "), name: " Test Member ",
            systemRole: "admin", isEmailVerified: true, tokenVersion: 200,
        }
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.requiresEmailVerification, true);
    assert.equal(result.body.email, "member@example.test");
    assert.equal(result.body.token, undefined);
    assert.equal(result.body.user, undefined);
    assert.equal(h.issuedSessions.length, 0);
    assert.equal(h.rows[0].systemRole, "member");
    assert.equal(h.rows[0].isEmailVerified, false);
    assert.equal(h.emails.length, 1);
    assert.notEqual(h.rows[0].password, password);
});

test("SMTP failure retains a pending account that can be retried later", async () => {
    const h = harness({ sendEmail: async () => { throw new Error("SMTP unavailable"); } });
    const result = await invoke(h.controller.register, { body: { ...credentials(), name: "Test Member" } });
    assert.equal(result.status, 503);
    assert.equal(result.body.requiresEmailVerification, true);
    assert.equal(h.rows.length, 1);
    assert.equal(h.rows[0].isEmailVerified, false);
    assert.equal(h.rows[0].emailVerificationToken, null);
    assert.ok(h.rows[0].emailVerificationSentAt);
    assert.equal(h.issuedSessions.length, 0);
});

test("pending login requires the correct password before revealing verification state", async () => {
    const h = harness();
    h.seed({ password: fakeHash(password) });
    const wrong = await invoke(h.controller.login, { body: { ...credentials(), password: "wrong" } });
    const pending = await invoke(h.controller.login, { body: credentials() });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.requiresEmailVerification, undefined);
    assert.equal(pending.status, 403);
    assert.equal(pending.body.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(h.issuedSessions.length, 0);
});

test("verification stores only a hash and consumes the link once without issuing a JWT", async () => {
    const h = harness();
    await invoke(h.controller.register, { body: { ...credentials(), name: "Test Member" } });
    const token = emailToken(h.emails[0]);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(h.rows[0].emailVerificationToken, hashToken(token));
    assert.equal(JSON.stringify(h.rows).includes(token), false);
    const first = await invoke(h.controller.verifyEmail, { body: { token } });
    const second = await invoke(h.controller.verifyEmail, { body: { token } });
    assert.equal(first.status, 200);
    assert.equal(first.body.token, undefined);
    assert.equal(second.status, 400);
    assert.equal(h.rows[0].isEmailVerified, true);
    assert.equal(h.rows[0].emailVerificationToken, null);
    assert.equal(h.rows[0].tokenVersion, 1);
    const login = await invoke(h.controller.login, { body: credentials() });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.isEmailVerified, true);
    for (const field of ["password", "tokenVersion", "emailVerificationToken", "googleId"]) {
        assert.equal(login.body.user[field], undefined);
    }
});

test("invalid-shaped, expired, and deactivated-account verification links are rejected", async () => {
    const f = serviceFixture();
    for (const token of [undefined, {}, "short", "A".repeat(64)]) {
        assert.equal((await f.service.confirmVerification(token)).status, "invalid");
    }
    await f.service.requestVerification({ user: f.user });
    const token = emailToken(f.emails[0]);
    f.row(f.user._id).isActive = false;
    assert.equal((await f.service.confirmVerification(token)).status, "invalid");
    f.row(f.user._id).isActive = true;
    f.advance(24 * 60 * 60 * 1000);
    assert.equal((await f.service.confirmVerification(token)).status, "invalid");
    assert.equal(f.row(f.user._id).isEmailVerified, false);
});

test("simultaneous confirmation requests have one winner", async () => {
    const f = serviceFixture();
    await f.service.requestVerification({ user: f.user });
    const token = emailToken(f.emails[0]);
    const results = await Promise.all([f.service.confirmVerification(token), f.service.confirmVerification(token)]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["invalid", "verified"]);
    assert.equal(f.row(f.user._id).tokenVersion, 1);
});

test("cooldown is claimed once, and a later resend replaces the previous link", async () => {
    const f = serviceFixture();
    const first = await Promise.all([
        f.service.requestVerification({ user: f.user }),
        f.service.requestVerification({ user: f.user }),
    ]);
    assert.deepEqual(first.map((r) => r.status).sort(), ["not-sent", "sent"]);
    assert.equal(f.emails.length, 1);
    const oldToken = emailToken(f.emails[0]);
    f.advance(60000);
    assert.equal((await f.service.requestVerification({ user: f.user })).status, "sent");
    assert.equal((await f.service.confirmVerification(oldToken)).status, "invalid");
    assert.equal((await f.service.confirmVerification(emailToken(f.emails[1]))).status, "verified");
});

test("late SMTP failure cannot restore an old challenge over a newer send", async () => {
    let rejectFirst;
    let began;
    const started = new Promise((resolve) => { began = resolve; });
    const emails = [];
    const f = serviceFixture({}, (message) => {
        emails.push(message);
        if (emails.length === 1) return new Promise((resolve, reject) => { rejectFirst = reject; began(); });
        return Promise.resolve();
    });
    const first = f.service.requestVerification({ user: f.user });
    await started;
    f.advance(60000);
    await f.service.requestVerification({ user: f.user });
    const latest = emailToken(emails[1]);
    rejectFirst(new Error("Delayed delivery failure"));
    assert.equal((await first).status, "delivery-failed");
    assert.equal(f.row(f.user._id).emailVerificationToken, hashToken(latest));
    assert.equal((await f.service.confirmVerification(latest)).status, "verified");
});

test("failed resend preserves the previous delivered link", async () => {
    const f = serviceFixture();
    await f.service.requestVerification({ user: f.user });
    const original = emailToken(f.emails[0]);
    f.advance(60000);
    const failing = createEmailVerificationService({
        User: f.User, now: () => new Date("2026-09-10T10:01:00Z"),
        sendEmail: async () => { throw new Error("SMTP unavailable"); }
    });
    assert.equal((await failing.requestVerification({ user: f.user })).status, "delivery-failed");
    assert.equal((await f.service.confirmVerification(original)).status, "verified");
});

test("resend returns the same public response for absent, pending, verified, and inactive accounts", async () => {
    const h = harness();
    h.seed();
    h.seed({ email: "verified@example.test", isEmailVerified: true });
    h.seed({ email: "inactive@example.test", isActive: false });
    const results = [];
    for (const email of ["absent@example.test", "member@example.test", "verified@example.test", "inactive@example.test", "member@example.test"]) {
        const result = await invoke(h.controller.resendVerification, { body: { email } });
        results.push({ status: result.status, body: result.body });
    }
    for (const result of results) assert.deepEqual(result, results[0]);
    assert.equal(h.emails.length, 1);
});

test("old sessions cannot bypass verification, deactivation, or token-version revocation", async () => {
    const h = harness();
    const user = h.seed();
    delete h.row(user._id).isEmailVerified;
    const token = h.generateToken(user._id, 0);
    const pending = await invoke(h.middleware.protect, { token });
    assert.equal(pending.status, 403);
    assert.equal(pending.body.code, "EMAIL_VERIFICATION_REQUIRED");
    h.row(user._id).isEmailVerified = true;
    assert.equal((await invoke(h.middleware.protect, { token })).next, true);
    h.row(user._id).isActive = false;
    assert.equal((await invoke(h.middleware.protect, { token })).status, 403);
    h.row(user._id).isActive = true;
    h.row(user._id).tokenVersion = 1;
    assert.equal((await invoke(h.middleware.protect, { token })).status, 401);
});

test("legacy records with missing tokenVersion can verify", async () => {
    const f = serviceFixture();
    delete f.row(f.user._id).tokenVersion;
    delete f.row(f.user._id).isEmailVerified;
    await f.service.requestVerification({ user: f.user });
    assert.equal((await f.service.confirmVerification(emailToken(f.emails[0]))).status, "verified");
    assert.equal(f.row(f.user._id).tokenVersion, 1);
});

test("email changes require a password and retain the old email until confirmation", async () => {
    const h = harness();
    const user = h.seed({ password: fakeHash(password), isEmailVerified: true });
    const body = { name: "Updated Name", email: "new@example.test", currentPassword: "wrong" };
    assert.equal((await invoke(h.controller.updateProfile, { user, body })).status, 400);
    assert.equal(h.emails.length, 0);
    body.currentPassword = password;
    const pending = await invoke(h.controller.updateProfile, { user, body });
    assert.equal(pending.status, 200);
    assert.equal(pending.body.user.email, user.email);
    assert.equal(pending.body.user.pendingEmail, body.email);
    assert.equal(pending.body.user.name, "Updated Name");
    assert.equal((await invoke(h.controller.login, { body: credentials() })).status, 200);
    assert.equal((await invoke(h.controller.login, { body: credentials(body.email) })).status, 401);
    const token = emailToken(h.emails[0]);
    assert.equal((await invoke(h.controller.verifyEmail, { body: { token } })).status, 200);
    assert.equal(h.row(user._id).email, body.email);
    assert.equal(h.row(user._id).pendingEmail, null);
    assert.equal(h.row(user._id).tokenVersion, 1);
    assert.equal(h.emails[1].to, user.email);
    assert.equal((await invoke(h.controller.login, { body: credentials() })).status, 401);
    assert.equal((await invoke(h.controller.login, { body: credentials(body.email) })).status, 200);
});

test("pending email change can be cancelled and its link then fails", async () => {
    const h = harness();
    const user = h.seed({ password: fakeHash(password), isEmailVerified: true });
    await invoke(h.controller.updateProfile, { user, body: { email: "new@example.test", currentPassword: password } });
    const token = emailToken(h.emails[0]);
    assert.equal((await invoke(h.controller.cancelEmailChange, { user })).status, 200);
    assert.equal(h.row(user._id).email, user.email);
    assert.equal(h.row(user._id).pendingEmail, null);
    assert.equal((await invoke(h.controller.verifyEmail, { body: { token } })).status, 400);
});

test("email uniqueness is checked again when a pending address is confirmed", async () => {
    const f = serviceFixture({ isEmailVerified: true });
    await f.service.requestVerification({ user: f.user, targetEmail: "taken@example.test", purpose: "change-email" });
    f.seed({ email: "taken@example.test" });
    assert.equal((await f.service.confirmVerification(emailToken(f.emails[0]))).status, "email-unavailable");
    assert.equal(f.row(f.user._id).email, f.user.email);
    assert.equal(f.row(f.user._id).tokenVersion, 0);
});

test("verification cannot act on an address that changed since the email was sent", async () => {
    const f = serviceFixture();
    await f.service.requestVerification({ user: f.user });
    f.row(f.user._id).email = "changed@example.test";
    assert.equal((await f.service.confirmVerification(emailToken(f.emails[0]))).status, "invalid");
});

test("password recovery is email-bound, single-use, and confirms inbox ownership", async () => {
    const h = harness();
    const user = h.seed({ password: fakeHash(password) });
    await invoke(h.controller.forgotPassword, { body: { email: user.email } });
    const token = emailToken(h.emails[0], "reset");
    assert.equal(h.row(user._id).passwordResetToken, hashToken(token));
    assert.equal(h.row(user._id).passwordResetEmail, user.email);
    const body = { password: "A new password 84!", confirmPassword: "A new password 84!" };
    const first = await invoke(h.controller.resetPassword, { body, params: { token } });
    const second = await invoke(h.controller.resetPassword, { body, params: { token } });
    assert.equal(first.status, 200);
    assert.equal(first.body.token, undefined);
    assert.equal(second.status, 400);
    assert.equal(h.row(user._id).isEmailVerified, true);
    assert.equal(h.row(user._id).passwordResetToken, null);
    assert.equal(h.row(user._id).tokenVersion, 1);
    assert.equal((await invoke(h.controller.login, { body: credentials() })).status, 401);
    assert.equal((await invoke(h.controller.login, { body: { email: user.email, password: body.password } })).status, 200);
});

test("concurrent resets consume a link only once", async () => {
    const h = harness();
    const user = h.seed({ password: fakeHash(password) });
    await invoke(h.controller.forgotPassword, { body: { email: user.email } });
    const token = emailToken(h.emails[0], "reset");
    const request = { params: { token }, body: { password: "New password 84!", confirmPassword: "New password 84!" } };
    const results = await Promise.all([
        invoke(h.controller.resetPassword, request), invoke(h.controller.resetPassword, request),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal(h.row(user._id).tokenVersion, 1);
});

test("reset rejects changed addresses, legacy unbound links, expiry, and inactive users", async () => {
    for (const scenario of ["email", "legacy", "expiry", "inactive"]) {
        const h = harness();
        const user = h.seed({ password: fakeHash(password) });
        await invoke(h.controller.forgotPassword, { body: { email: user.email } });
        const token = emailToken(h.emails[0], "reset");
        const row = h.row(user._id);
        if (scenario === "email") row.email = "changed@example.test";
        if (scenario === "legacy") delete row.passwordResetEmail;
        if (scenario === "expiry") row.passwordResetExpires = new Date(0);
        if (scenario === "inactive") row.isActive = false;
        const result = await invoke(h.controller.resetPassword, {
            params: { token }, body: { password: "New password 84!", confirmPassword: "New password 84!" },
        });
        assert.equal(result.status, 400, scenario);
        assert.equal(row.password, fakeHash(password), scenario);
        assert.equal(row.isEmailVerified, false, scenario);
    }
});

test("reset responses remain generic and repeated requests respect cooldown", async () => {
    const h = harness();
    h.seed();
    const present = await invoke(h.controller.forgotPassword, { body: { email: "member@example.test" } });
    const absent = await invoke(h.controller.forgotPassword, { body: { email: "absent@example.test" } });
    const cooldown = await invoke(h.controller.forgotPassword, { body: { email: "member@example.test" } });
    assert.deepEqual(present.body, absent.body);
    assert.deepEqual(present.body, cooldown.body);
    assert.equal(h.emails.length, 1);
});

test("password change revokes old sessions and clears outstanding email/reset challenges", async () => {
    const h = harness();
    const user = h.seed({
        password: fakeHash(password), isEmailVerified: true,
        emailVerificationToken: "old-challenge", passwordResetToken: "old-reset", pendingEmail: "new@example.test"
    });
    const oldToken = h.generateToken(user._id, 0);
    const result = await invoke(h.controller.changePassword, {
        user, body: {
            currentPassword: password, newPassword: "A new password 84!", confirmPassword: "A new password 84!",
        }
    });
    assert.equal(result.status, 200);
    assert.equal(h.row(user._id).emailVerificationToken, null);
    assert.equal(h.row(user._id).passwordResetToken, null);
    assert.equal(h.row(user._id).pendingEmail, null);
    assert.equal((await invoke(h.middleware.protect, { token: oldToken })).status, 401);
    assert.equal((await invoke(h.middleware.protect, { token: result.body.token })).next, true);
});

test("Google Gmail and Workspace identities can create verified accounts", async () => {
    for (const claims of [{ email: "googleuser@gmail.com" }, { email: "googleuser@example.test", hd: "example.test" }]) {
        const h = harness();
        h.google.payload = { sub: "google-subject", email_verified: true, name: "Google Member", ...claims };
        const result = await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } });
        assert.equal(result.status, 200);
        assert.equal(result.body.user.isEmailVerified, true);
        assert.equal(result.body.user.googleId, undefined);
        assert.equal(h.emails.length, 0);
    }
});

test("third-party Google email requires LeadFlow inbox verification", async () => {
    const h = harness();
    h.google.payload = { sub: "google-subject", email: "googleuser@example.test", email_verified: true };
    const result = await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } });
    assert.equal(result.status, 403);
    assert.equal(result.body.requiresEmailVerification, true);
    assert.equal(h.emails.length, 1);
    assert.equal(h.issuedSessions.length, 0);
    await invoke(h.controller.verifyEmail, { body: { token: emailToken(h.emails[0]) } });
    assert.equal((await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } })).status, 200);
});

test("Google cannot activate a pre-existing unverified password account by email", async () => {
    const h = harness();
    const user = h.seed({ email: "googleuser@gmail.com", password: fakeHash(password) });
    h.google.payload = { sub: "google-subject", email: user.email, email_verified: true };
    const result = await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "ACCOUNT_LINK_REQUIRED");
    assert.equal(h.row(user._id).googleId, undefined);
    assert.equal(h.row(user._id).isEmailVerified, false);
    assert.equal(h.issuedSessions.length, 0);
});

test("Google links a verified account only when authoritative for its email", async () => {
    for (const email of ["googleuser@gmail.com", "googleuser@example.test"]) {
        const h = harness();
        const user = h.seed({ email, isEmailVerified: true, password: fakeHash(password) });
        h.google.payload = { sub: "google-subject", email, email_verified: true };
        const result = await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } });
        assert.equal(result.status, email.endsWith("@gmail.com") ? 200 : 409);
        assert.equal(h.row(user._id).googleId, email.endsWith("@gmail.com") ? "google-subject" : undefined);
    }
});

test("existing linked Google users can verify without overwriting a changed login email", async () => {
    const h = harness();
    const user = h.seed({ email: "googleuser@gmail.com", googleId: "google-subject" });
    delete h.row(user._id).isEmailVerified;
    h.google.payload = { sub: "google-subject", email: user.email, email_verified: true, picture: "https://example.test/photo.png" };
    const verified = await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } });
    assert.equal(verified.status, 200);
    assert.equal(h.row(user._id).isEmailVerified, true);
    assert.equal(h.row(user._id).tokenVersion, 1);
    h.row(user._id).email = "changed@example.test";
    const again = await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } });
    assert.equal(again.status, 200);
    assert.equal(again.body.user.email, "changed@example.test");
    assert.equal(again.body.user.profilePicture, "https://example.test/photo.png");
});

test("invalid Google claims cannot create users or sessions", async () => {
    for (const payload of [null, {}, { sub: "google-subject", email: "user@gmail.com", email_verified: false }]) {
        const h = harness();
        h.google.payload = payload;
        assert.equal((await invoke(h.controller.googleLogin, { body: { credential: "mock-google-credential" } })).status, 401);
        assert.equal(h.rows.length, 0);
        assert.equal(h.issuedSessions.length, 0);
    }
});

test("new password validation checks bcrypt's byte limit, including Unicode", () => {
    assert.equal(passwordError("a".repeat(72)), null);
    assert.ok(passwordError("a".repeat(73)));
    assert.equal(passwordError("😀".repeat(18)), null);
    assert.ok(passwordError("😀".repeat(19)));
});
