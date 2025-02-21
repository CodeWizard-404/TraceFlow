const { Sequelize } = require('sequelize');
require('dotenv').config();

async function initializeDatabase() {
    const adminSequelize = new Sequelize('postgres', process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false
    });

    try {
        // Check if database exists
        const result = await adminSequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`
        );

        // Create database only if it doesn't exist
        if (result[0].length === 0) {
            await adminSequelize.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
            console.log(`Database ${process.env.DB_NAME} created successfully`);
        } else {
            console.log(`Database ${process.env.DB_NAME} already exists`);
        }
    } catch (error) {
        console.error('Error creating database:', error);
    } finally {
        await adminSequelize.close();
    }
}

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
}
);

module.exports = {
    sequelize,
    initializeDatabase
};