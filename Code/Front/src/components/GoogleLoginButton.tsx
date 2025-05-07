import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { getGoogleAuthUrl } from '../apis/authAPI';

const GoogleLoginButton: React.FC = () => {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = await getGoogleAuthUrl();
            window.location.href = url;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to initiate Google login.';
            setError(errorMessage);
            console.error('Google login error:', errorMessage);
        } finally {
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