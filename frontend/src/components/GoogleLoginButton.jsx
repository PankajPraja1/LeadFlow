import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { googleLogin } from "../features/auth/authSlice";

// GoogleLoginButton component handles the Google OAuth login process. It dispatches the googleLogin action and navigates to the dashboard upon successful login.
function GoogleLoginButton() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isLoading } = useSelector((state) => state.auth);

    const [googleError, setGoogleError] = useState("");

    const handleGoogleSuccess = async (credentialResponse) => {
        if (isLoading) return;

        if (!credentialResponse.credential) {
            setGoogleError("Google did not return a valid credential");
            return;
        }

        try {
            setGoogleError("");

            await dispatch(
                googleLogin(credentialResponse.credential)
            ).unwrap();

            navigate("/dashboard", {
                replace: true,
            });
        } catch (failure) {
            if (failure?.requiresEmailVerification) {
                navigate("/verify-email", {
                    replace: true,
                    state: {
                        email: failure.email,
                        message: failure.message,
                    },
                });
            }

            // Other backend errors are displayed through Redux.
        }
    };


    return (
        <div className="space-y-2">
            <div className={isLoading ? "pointer-events-none opacity-60" : ""}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() =>
                    setGoogleError("Google sign-in was cancelled or failed")
                }
                    text="continue_with" shape="rectangular" theme="outline" size="large" width="400" />
            </div>

            {googleError && (
                <p className="text-center text-sm text-red-600">
                    {googleError}
                </p>
            )}
        </div>
    ); // The component renders a GoogleLogin button and displays any error messages related to the Google login process. It also handles the loading state by disabling interactions with the button when a login request is in progress.
} // Returns the GoogleLoginButton component, which provides a user interface for logging in with Google OAuth.

export default GoogleLoginButton;
