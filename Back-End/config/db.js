const { Sequelize } = require('sequelize');
const { Client } = require('pg');
require('dotenv').config();

// Function to create the database if it doesn't exist
async function createDatabaseIfNotExists() {
    const dbName = process.env.DB_NAME || 'timesheet_db';
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        password: process.env.DB_PASSWORD || null,
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname='${dbName}'`);
        if (res.rowCount === 0) {
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database "${dbName}" created successfully.`);
        } else {
            console.log(`Database "${dbName}" already exists.`);
        }
    } catch (error) {
        console.error('Error creating database:', error.message);
    } finally {
        await client.end();
    }
}

// Initialize Sequelize after ensuring the database exists
async function initializeDatabase() {
    await createDatabaseIfNotExists();

    const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
    });

    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error.message);
    }

    return sequelize;
}

module.exports = initializeDatabase();