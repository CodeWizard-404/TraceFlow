import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';

const GoogleLoginButton: React.FC = () => {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
            const realm = import.meta.env.VITE_REALM || 'TraceFlow';
            const clientId = import.meta.env.VITE_CLIENT_ID || 'traceflow-backend';
            const redirectUri = encodeURIComponent('http://localhost:5000/api/auth/callback');
            const authUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&kc_idp_hint=google`;
            console.debug('Initiating Google OAuth redirect', { authUrl });
            window.location.href = authUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to initiate Google login.';
            setError(errorMessage);
            console.error('Google login error:', errorMessage, { error: err });
            setLoading(false);
        }
    };

    return (
        <div className="form-group">
            {error && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="error-message"
                >
                    {error}
                </motion.div>
            )}
            <motion.button
                type="button"
                className="action-button-0"
                onClick={handleGoogleLogin}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '0.5rem 1rem',
                }}
            >
                {loading ? (
                    <span className="spinner" />
                ) : (
                    <>
                        <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            borderRadius: '50%',
                            padding: '0.3rem',
                        }}>
                            <FcGoogle size={20} />
                        </div>
                        Sign in with Google
                    </>
                )}
            </motion.button>
        </div>
    );
};

export default GoogleLoginButton;