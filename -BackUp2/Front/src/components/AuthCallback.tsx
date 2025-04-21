// import { useEffect, useState } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom';
// import { handleGoogleCallback } from '../apis/authAPI';
// import { useAuth } from '../context/AuthContext';

// const AuthCallback = () => {
//     const navigate = useNavigate();
//     const location = useLocation();
//     const { loginUser } = useAuth();
//     const [error, setError] = useState<string | null>(null);
//     const [isProcessing, setIsProcessing] = useState(false);

//     useEffect(() => {
//         const handleCallback = async () => {
//             if (isProcessing) {
//                 console.log('AuthCallback: Already processing, skipping');
//                 return;
//             }
//             setIsProcessing(true);

//             try {
//                 console.log('AuthCallback: Processing callback', {
//                     search: location.search,
//                     pathname: location.pathname,
//                 });
//                 const params = new URLSearchParams(location.search);
//                 const code = params.get('code');
//                 const state = params.get('state');
//                 const errorParam = params.get('error');

//                 if (errorParam) {
//                     throw new Error(`OAuth error: ${errorParam}`);
//                 }
//                 if (!code || !state) {
//                     throw new Error('Missing code or state parameter');
//                 }

//                 // Validate state
//                 const storedState = localStorage.getItem('oauth_state');
//                 if (state !== storedState) {
//                     throw new Error('Invalid state parameter');
//                 }

//                 console.log('AuthCallback: Sending Google callback', { code, state });
//                 const response = await handleGoogleCallback(code, state);

//                 console.log('AuthCallback: Google callback response', response);

//                 if (response.requires2FA) {
//                     console.log('AuthCallback: Redirecting to 2FA', {
//                         userID: response.userID,
//                     });
//                     navigate('/verify-2fa', {
//                         state: {
//                             userID: response.userID,
//                             tempToken: response.tempToken,
//                             refreshToken: response.refreshToken,
//                             deviceIdentifier: response.deviceIdentifier,
//                         },
//                     });
//                     return;
//                 }

//                 if (!response.user || !response.user.userID || !response.tempToken || !response.refreshToken || !response.deviceIdentifier) {
//                     throw new Error('Invalid Google callback response');
//                 }

//                 console.log('AuthCallback: Logging in user', {
//                     email: response.user.email,
//                     userID: response.user.userID,
//                 });
//                 await loginUser(
//                     response.user.email,
//                     '',
//                     response.deviceIdentifier,
//                     undefined, // otpCode
//                     false, // trustDevice
//                     response.tempToken,
//                     response.refreshToken,
//                     response.user.userID
//                 );

//                 console.log('AuthCallback: Redirecting to home page');
//                 navigate('/', { replace: true });
//                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
//             } catch (err: any) {
//                 console.error('AuthCallback: Error', {
//                     message: err.message,
//                     stack: err.stack,
//                     search: location.search,
//                 });
//                 setError(err.message || 'Authentication failed. Please try again.');
//                 navigate('/login', { state: { error: err.message } });
//             } finally {
//                 localStorage.removeItem('oauth_state');
//                 setIsProcessing(false);
//             }
//         };

//         handleCallback();
//     }, [navigate, location, loginUser, isProcessing]);

//     if (error) {
//         return <div>Error: {error}</div>;
//     }

//     return <div>Processing authentication...</div>;
// };

// export default AuthCallback;