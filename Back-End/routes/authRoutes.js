const express = require('express');
const router = express.Router();
//const { keycloak } = require('../config/security'); // Import keycloak instance
const AuthController = require('../controllers/authController');

router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);



// // Keycloak login redirect
// router.get('/login', keycloak.protect(), (req, res) => {
//     // If authenticated, redirect to dashboard; otherwise, Keycloak redirects to its login page
//     res.redirect('/admin');
// });

// // Callback route for Keycloak redirect
// router.get('/callback', keycloak.middleware(), (req, res) => {
//     if (req.kauth.grant) {
//         console.log('User authenticated:', req.kauth.grant.access_token.content);
//         res.redirect('/admin');
//     } else {
//         res.status(401).json({ error: 'Authentication failed' });
//     }
// });

// // Logout route
// router.get('/logout', keycloak.middleware({ logout: true }), (req, res) => {
//     req.session.destroy((err) => {
//         if (err) {
//             console.error('Session destruction error:', err);
//             return res.status(500).json({ error: 'Logout failed' });
//         }
//         res.redirect('/login');
//     });
// });

// // Protected route example
// router.get('/admin', keycloak.protect(), (req, res) => {
//     res.json({ message: 'Welcome to the dashboard!', user: req.kauth.grant.access_token.content });
// });

module.exports = router;