const { Client } = require('pg');
require('dotenv').config();

// Load environment variables from .env file
const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function listenForOTPChanges() {
    try {
        await client.connect();  // Connect to the database

        // Listen to the channel we defined in the PostgreSQL trigger
        await client.query('LISTEN otp_channel');

        console.log('Listening for OTP changes...');

        // Event listener for notifications
        client.on('notification', (msg) => {
            console.log('New OTP notification received:', msg.payload);
            // Do something when a new OTP is added, like processing or logging.
        });
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
}

listenForOTPChanges();

// Gracefully handle process exit
process.on('SIGINT', async () => {
    console.log('Gracefully shutting down...');
    await client.end();
    process.exit();
});

