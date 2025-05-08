// const axios = require('axios');
// const logger = require('../utils/logger');
// require('dotenv').config();

// const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
// const REALM = process.env.REALM || 'TraceFlow';

// const validateCookie = async (req, res, next) => {
//     const accessToken = req.cookies.accessToken;

//     if (!accessToken) {
//         return res.status(401).json({ error: 'No access token provided.' });
//     }

//     try {
//         const response = await axios.get(
//             `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/userinfo`,
//             {
//                 headers: { Authorization: `Bearer ${accessToken}` },
//             }
//         );

//         const userData = response.data;
//         req.user = {
//             userID: userData.sub,
//             email: userData.email,
//             roles: userData.realm_access?.roles || [],
//         };

//         next();
//     } catch (error) {
//         logger.error(`Token validation failed: ${error.message}`);
//         return res.status(401).json({ error: 'Invalid or expired token.' });
//     }
// };

// module.exports = { validateCookie };