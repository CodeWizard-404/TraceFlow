const { sequelize } = require('../models');
const CsvHeader = require('../models').CsvHeader;

async function seedCsvHeaders() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established.');

        const defaultHeaders = [
            { csvType: 'agent', expectedHeader: 'firstname', mappedHeader: 'firstname' },
            { csvType: 'agent', expectedHeader: 'lastname', mappedHeader: 'lastname' },
            { csvType: 'agent', expectedHeader: 'email', mappedHeader: 'email' },
            { csvType: 'agent', expectedHeader: 'phone', mappedHeader: 'phone' },
            { csvType: 'agent', expectedHeader: 'delegation', mappedHeader: 'delegation' },
            { csvType: 'agent', expectedHeader: 'governorate', mappedHeader: 'governorate' },
            { csvType: 'agent', expectedHeader: 'supervisor_phone', mappedHeader: 'supervisor_phone' },
        ];

        for (const header of defaultHeaders) {
            await CsvHeader.upsert(header);
        }

        console.log('CSV headers seeded successfully.');
    } catch (error) {
        console.error('Error seeding CSV headers:', error);
    } finally {
        await sequelize.close();
    }
}

seedCsvHeaders();