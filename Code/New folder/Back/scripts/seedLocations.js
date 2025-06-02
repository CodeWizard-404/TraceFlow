const fs = require('fs');
const path = require('path');
const { sequelize, Region, Governorate, Delegation } = require('../models');

async function populateGeographicData() {
    try {
        // Debug: Verify models
        console.log('Region model:', Region);
        console.log('Is Region a Sequelize model?', typeof Region.findOne === 'function');
        console.log('Governorate model:', Governorate);
        console.log('Is Governorate a Sequelize model?', typeof Governorate.findOne === 'function');

        // Define regions
        const regions = [
            {
                name: 'Grand Tunis',
                nameAr: 'تونس الكبرى',
                nameFr: 'Grand Tunis',
                governorates: ['Tunis', 'Ariana', 'Ben Arous', 'Manubah']
            },
            {
                name: 'Sud Est',
                nameAr: 'الجنوب الشرقي',
                nameFr: 'Sud Est',
                governorates: ['Gabès', 'Médenine', 'Tataouine']
            },
            {
                name: 'Centre Est',
                nameAr: 'الوسط الشرقي',
                nameFr: 'Centre Est',
                governorates: ['Sousse', 'Monastir', 'Mahdia', 'Sfax']
            },
            {
                name: 'Sud Ouest',
                nameAr: 'الجنوب الغربي',
                nameFr: 'Sud Ouest',
                governorates: ['Gafsa', 'Tozeur', 'Kebili']
            },
            {
                name: 'Nord Est',
                nameAr: 'الشمال الشرقي',
                nameFr: 'Nord Est',
                governorates: ['Nabeul', 'Zaghouan', 'Bizerte']
            },
            {
                name: 'Nord Ouest',
                nameAr: 'الشمال الغربي',
                nameFr: 'Nord Ouest',
                governorates: ['Béja', 'Jendouba', 'Le Kef', 'Siliana']
            },
            {
                name: 'Centre Ouest',
                nameAr: 'الوسط الغربي',
                nameFr: 'Centre Ouest',
                governorates: ['Kairouan', 'Kassérine', 'Sidi Bou Zid']
            }
        ];

        // Seed regions
        const regionMap = new Map();
        for (const regionData of regions) {
            const existing = await Region.findOne({ where: { nameFr: regionData.nameFr } });
            let region;
            if (!existing) {
                region = await Region.create({
                    name: regionData.name,
                    nameAr: regionData.nameAr,
                    nameFr: regionData.nameFr
                });
            } else {
                region = existing;
            }
            regionMap.set(regionData.nameFr, region.regionID);
        }

        // Read the JSON file
        const data = fs.readFileSync(path.join(__dirname, './delegations.json'), 'utf8');
        const jsonData = JSON.parse(data);

        // Extract governorates and delegations
        const governorates = new Map();
        const delegations = [];

        jsonData.objects.delegations.geometries.forEach((item, index) => {
            const props = item.properties;

            // Validate gov_name_f
            if (!props.gov_name_f || typeof props.gov_name_f !== 'string' || props.gov_name_f.trim() === '') {
                console.warn(`Skipping invalid entry at index ${index}: gov_name_f is missing or invalid`, props);
                return;
            }

            // Add governorate to map
            if (!governorates.has(props.gov_name_f)) {
                // Find the region for this governorate
                let regionID = null;
                for (const region of regions) {
                    if (region.governorates.includes(props.gov_name_f)) {
                        regionID = regionMap.get(region.nameFr);
                        break;
                    }
                }
                if (!regionID) {
                    console.warn(`No region found for governorate: ${props.gov_name_f}`);
                    return;
                }

                governorates.set(props.gov_name_f, {
                    name: props.gov_name_f || '',
                    nameAr: props.gov_name_a || '',
                    nameFr: props.gov_name_f,
                    regionID
                });
            }

            // Add delegation
            delegations.push({
                name: props.deleg_na_1 || '',
                nameAr: props.deleg_name || '',
                nameFr: props.deleg_na_1 || '',
                governorateNameFr: props.gov_name_f
            });
        });

        // Insert governorates (unique)
        for (const [nameFr, govData] of governorates) {
            if (!nameFr || typeof nameFr !== 'string' || nameFr.trim() === '') {
                console.warn(`Skipping invalid governorate with nameFr: ${nameFr}`);
                continue;
            }

            const existing = await Governorate.findOne({ where: { nameFr } });
            if (!existing) {
                await Governorate.create(govData);
            } else {
                // Update regionID if governorate already exists
                await Governorate.update(
                    { regionID: govData.regionID },
                    { where: { nameFr } }
                );
            }
        }

        // Create map of governorate names to IDs
        const governorateMap = await Governorate.findAll();
        const governorateIdMap = governorateMap.reduce((acc, gov) => {
            acc[gov.nameFr] = gov.governorateID;
            return acc;
        }, {});

        // Insert delegations with governorateID
        for (const del of delegations) {
            const governorateID = governorateIdMap[del.governorateNameFr];
            if (!governorateID) {
                console.warn(`Skipping delegation with missing governorateID for governorateNameFr: ${del.governorateNameFr}`);
                continue;
            }

            if (!del.nameFr || typeof del.nameFr !== 'string' || del.nameFr.trim() === '') {
                console.warn(`Skipping invalid delegation with nameFr: ${del.nameFr}`);
                continue;
            }

            const existing = await Delegation.findOne({
                where: {
                    nameFr: del.nameFr,
                    governorateID
                }
            });
            if (!existing) {
                await Delegation.create({
                    ...del,
                    governorateID
                });
            }
        }

        console.log('Geographic data populated successfully');
    } catch (error) {
        console.error('Error populating geographic data:', error);
        throw error;
    }
}

module.exports = populateGeographicData;