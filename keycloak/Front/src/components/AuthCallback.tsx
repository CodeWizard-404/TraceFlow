import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { handleGoogleCallback } from '../apis/authAPI';

const AuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginUser } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (!code) {
                navigate('/login', { state: { error: 'Authentication failed. Please try again.' } });
                return;
            }

            try {
                const response = await handleGoogleCallback(code, state);
                await loginUser(
                    response.user!.email,
                    '', // No password needed for Google login
                    undefined,
                    false,
                    response.tempToken,
                    response.refreshToken,
                    response.userID
                );
                navigate('/', { replace: true });
            } catch (error) {
                console.error('Google callback error:', error);
                navigate('/login', { state: { error: 'Authentication failed. Please try again.' } });
            }
        };

        handleCallback();
    }, [searchParams, navigate, loginUser]);

    return <div>Loading...</div>;
};

export default AuthCallback;