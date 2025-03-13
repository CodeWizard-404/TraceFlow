const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
    }
);

// Initializes the database by ensuring it exists and establishing a connection
async function initializeDatabase() {
    const adminSequelize = new Sequelize('postgres', process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
    });

    try {
        console.log(`${new Date().toISOString()} - Checking if database '${process.env.DB_NAME}' exists...`);
        const result = await adminSequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`
        );

        if (result[0].length === 0) {
            console.log(`${new Date().toISOString()} - Database '${process.env.DB_NAME}' not found, creating...`);
            await adminSequelize.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
            console.log(`${new Date().toISOString()} - Database '${process.env.DB_NAME}' created successfully`);
        } else {
            console.log(`${new Date().toISOString()} - Database '${process.env.DB_NAME}' already exists`);
        }

        console.log(`${new Date().toISOString()} - Attempting to connect to database '${process.env.DB_NAME}'...`);
        await sequelize.authenticate();
        console.log(`${new Date().toISOString()} - Database connection established`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Error initializing database:`, error);
        throw error; // Re-throw to be caught by the caller
    }
}

module.exports = { sequelize, initializeDatabase };