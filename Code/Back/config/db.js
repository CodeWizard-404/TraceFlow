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
        const result = await adminSequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`
        );

        if (result[0].length === 0) {
            await adminSequelize.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
            console.log(`${new Date().toISOString()} [\x1b[36minfo\x1b[0m]: \x1b[36mDatabase '${process.env.DB_NAME}' created successfully\x1b[0m`);
        } else {
            console.log(`${new Date().toISOString()} [\x1b[36minfo\x1b[0m]: \x1b[36mDatabase '${process.env.DB_NAME}' already exists\x1b[0m`);
        }

        await sequelize.authenticate();
    } catch (error) {
        throw error; // Re-throw to be caught by the caller
    }
}

module.exports = { sequelize, initializeDatabase };