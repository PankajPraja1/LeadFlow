import { ArrowLeft, CalendarDays, KeyRound, LogOut, Mail, Save, ShieldCheck, UserRound, } from "lucide-react";
import { useEffect, useState, } from "react";
import { useDispatch, useSelector, } from "react-redux";
import { useNavigate, } from "react-router-dom";
import { changeUserPassword, clearProfileFeedback, logout, updateUserProfile, } from "../features/auth/authSlice";

const emptyPasswordForm = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
};

// Formats a date string into a more readable format
const formatDate = (date) => {
    if (!date) { return "Unavailable" }

    return new Date(date).toLocaleDateString(undefined,
        {
            day: "numeric",
            month: "long",
            year: "numeric",
        }
    );
};

// ProfilePage component allows users to view and update their profile information and change their password.
function ProfilePage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    // ------------------------------------------
    const {
        user,
        isUpdatingProfile,
        isChangingPassword,
        profileError,
        profileMessage,
    } = useSelector((state) => state.auth);

    const [profileForm, setProfileForm,] = useState({
        name: "",
        email: "",
        currentPassword: "",
    });

    const [passwordForm, setPasswordForm,] = useState(emptyPasswordForm);

    const [validationError, setValidationError,] = useState("");

    useEffect(() => {
        if (user) {
            setProfileForm({
                name: user.name || "",
                email: user.email || "",
                currentPassword: "",
            });
        }
    }, [user]); // Update form fields when user data changes

    useEffect(() => {
        dispatch(clearProfileFeedback());

        return () => {
            dispatch(clearProfileFeedback());
        };
    }, [dispatch]); // Clear feedback on component mount and unmount
    // ------------------------------------------

    // Loading state: if data is still being fetched
    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-slate-500">
                    Loading profile...
                </p>
            </div>
        );
    }

    const normalizedEmail = profileForm.email.trim().toLowerCase(); // Normalize email for comparison

    const emailChanged = normalizedEmail !== user.email; // Check if the email has been changed

    const initials = user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(); // Generate initials from the user's name

    const clearFeedback = () => {
        setValidationError("");
        dispatch(clearProfileFeedback());
    };

    const handleProfileChange = (event) => {
        const { name, value } = event.target;

        clearFeedback();

        setProfileForm((currentForm) => ({ ...currentForm, [name]: value, }));
    }; // Handle changes in the profile form fields

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;

        clearFeedback();

        setPasswordForm((currentForm) => ({ ...currentForm, [name]: value, }));
    }; // Handle changes in the password form fields

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        clearFeedback();

        const normalizedName = profileForm.name.trim();

        if (!normalizedName) {
            setValidationError("Name is required");
            return;
        }

        if (!normalizedEmail) {
            setValidationError("Email is required");
            return;
        }

        if (emailChanged && !profileForm.currentPassword) {
            setValidationError("Enter your current password to change your email");
            return;
        }

        try {
            await dispatch(updateUserProfile({
                name: normalizedName,
                email: normalizedEmail, ...(emailChanged && {
                    currentPassword: profileForm.currentPassword,
                }),
            })).unwrap(); // Update the user profile and handle any errors

            setProfileForm((currentForm) => ({ ...currentForm, currentPassword: "", })); // Clear the current password field after successful update
        } catch {
            // Redux displays the API error.
        }
    }; // Handle profile form submission

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        clearFeedback();

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setValidationError("Complete all password fields");
            return;
        } // Check if all password fields are filled

        if (passwordForm.newPassword.length < 6) {
            setValidationError("New password must contain at least 6 characters");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setValidationError("New passwords do not match");
            return;
        }

        try {
            await dispatch(changeUserPassword(passwordForm)).unwrap();

            setPasswordForm(emptyPasswordForm);
        } catch {
            // Redux displays the API error.
        }
    }; // Handle password form submission

    const handleLogout = () => {
        dispatch(logout());
        navigate("/login");
    }; // Handle user logout and redirect to the login page

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
                    <button type="button" onClick={() => navigate("/dashboard")}
                        className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
                    >
                        <ArrowLeft size={18} />
                        Back to dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="h-9 w-9" />

                        <span className="hidden font-bold text-slate-900 sm:inline">
                            LeadFlow
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-5 py-8">
                <section>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Profile & Security
                    </h1>

                    <p className="mt-2 text-slate-500">
                        Manage your account information
                        and password.
                    </p>
                </section>

                {(validationError || profileError) && (
                    <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {validationError || profileError}
                    </div>
                )}

                {profileMessage && (
                    <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                        {profileMessage}
                    </div>
                )}

                <div className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
                    <aside className="space-y-6">
                        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
                                {initials}
                            </div>

                            <h2 className="mt-4 text-xl font-bold text-slate-900">
                                {user.name}
                            </h2>

                            <p className="mt-1 break-all text-sm text-slate-500">
                                {user.email}
                            </p>

                            <span className="mt-4 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold capitalize text-purple-700">
                                {user.systemRole}
                            </span>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="font-bold text-slate-900">
                                Account details
                            </h2>

                            <div className="mt-5 space-y-5">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-slate-400">
                                            Account status
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-emerald-700">
                                            {user.isActive === false ? "Inactive" : "Active"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <CalendarDays size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-slate-400">
                                            Member since
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-slate-700">
                                            {formatDate(user.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button type="button" onClick={handleLogout}
                                className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                                <LogOut size={17} />
                                Log out
                            </button>
                        </section>
                    </aside>

                    <div className="space-y-6">
                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
                                    <UserRound size={20} />
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Profile information
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Update your name and email address.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5" >
                                <div>
                                    <label htmlFor="profile-name" className="mb-2 block text-sm font-medium text-slate-700" >
                                        Full name
                                    </label>

                                    <input id="profile-name" name="name" value={profileForm.name} onChange={handleProfileChange} required minLength="2" maxLength="50" autoComplete="name"
                                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="profile-email" className="mb-2 block text-sm font-medium text-slate-700" >
                                        Email address
                                    </label>

                                    <div className="relative">
                                        <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                        <input id="profile-email" name="email" type="email" value={profileForm.email} onChange={handleProfileChange} required autoComplete="email"
                                            className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                {emailChanged && (
                                    <div>
                                        <label htmlFor="email-current-password" className="mb-2 block text-sm font-medium text-slate-700" >
                                            Current password
                                        </label>

                                        <input id="email-current-password" name="currentPassword" type="password" value={profileForm.currentPassword} onChange={handleProfileChange}
                                            required autoComplete="current-password" placeholder="Required to change email"
                                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />

                                        <p className="mt-2 text-xs text-slate-500">
                                            Changing your email requires password verification.
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end border-t border-slate-200 pt-5">
                                    <button type="submit" disabled={isUpdatingProfile} className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" >
                                        <Save size={17} />

                                        {isUpdatingProfile ? "Saving..." : "Save profile"}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-purple-100 p-2.5 text-purple-700">
                                    <KeyRound size={20} />
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Change password
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Changing your password invalidates your older sessions.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5" >
                                <div>
                                    <label htmlFor="current-password" className="mb-2 block text-sm font-medium text-slate-700" >
                                        Current password
                                    </label>

                                    <input id="current-password" name="currentPassword" type="password" value={passwordForm.currentPassword} onChange={handlePasswordChange}
                                        required autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-700" >
                                            New password
                                        </label>

                                        <input id="new-password" name="newPassword" type="password" value={passwordForm.newPassword} onChange={handlePasswordChange}
                                            required minLength="6" autoComplete="new-password"
                                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-700" >
                                            Confirm password
                                        </label>

                                        <input id="confirm-password" name="confirmPassword" type="password"
                                            value={passwordForm.confirmPassword} onChange={handlePasswordChange}
                                            required minLength="6" autoComplete="new-password"
                                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end border-t border-slate-200 pt-5">
                                    <button type="submit" disabled={isChangingPassword}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-purple-700 px-5 py-2.5 font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <KeyRound size={17} />

                                        {isChangingPassword ? "Changing..." : "Change password"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    ); // Render the profile page with forms for updating profile information and changing password
}

export default ProfilePage;
