const { Agent, Delegation } = require('../models');
const { nanoid } = require('nanoid');

async function seedAgents() {
    try {
        console.log('Starting agent seeding...');

        // Fetch all existing delegations
        const delegations = await Delegation.findAll({
            attributes: ['delegationID', 'nameFr'],
        });

        if (delegations.length === 0) {
            throw new Error('No delegations found in the database. Please seed geographic data first.');
        }

        // Find the Radès delegation
        const radesDelegation = delegations.find(delegation => delegation.nameFr === 'Radès');
        if (!radesDelegation) {
            throw new Error('Delegation "Radès" not found in the database.');
        }

        // Fetch existing agents to avoid email and phone duplicates
        const existingAgents = await Agent.findAll({
            attributes: ['email', 'phone'],
        });
        const existingEmails = new Set(existingAgents.map(agent => agent.email));
        const existingPhones = new Set(existingAgents.map(agent => agent.phone));

        // Define Tunisian names and settings for realistic data
        const firstNames = [
            'Mohamed', 'Ahmed', 'Sofien', 'Ghaith', 'Leila', 'Karim', 'Nour', 'Youssef', 'Amina', 'Hassan',
            'Sana', 'Omar', 'Rania', 'Tarek', 'Imen', 'Sami', 'Hiba', 'Fatima', 'Ali', 'Zied',
            'Amel', 'Khaled', 'Sarra', 'Bilel', 'Nadia', 'Wassim', 'Mouna', 'Fares', 'Lina', 'Anis',
        ];

        const lastNames = [
            'Ben Ali', 'Trabelsi', 'Gharbi', 'Jlassi', 'Mansour', 'Haddad', 'Chaabane', 'Karray', 'Saidi', 'Bouzid',
            'Dridi', 'Zouari', 'Hachicha', 'Feki', 'Lajmi', 'Gueddana', 'Belhadj', 'Mabrouk', 'Sassi', 'Ayari',
            'Baccar', 'Hamdi', 'Jebali', 'Mejri', 'Rekik', 'Salhi', 'Tounsi', 'Yahia', 'Zaarour', 'Ben Youssef',
        ];

        const streets = [
            'Avenue Habib Bourguiba', 'Rue de la Liberté', 'Boulevard 7 Novembre', 'Rue Farhat Hached',
            'Avenue de la République', 'Rue d\'Indépendance', 'Boulevard Mohamed V', 'Rue du 9 Avril',
            'Avenue Taieb Mhiri', 'Rue Ali Belhouane',
        ];

        const cities = [
            'Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Gabès', 'Kairouan', 'Ariana', 'Gafsa', 'Monastir', 'Ben Arous',
            'Nabeul', 'Mahdia', 'Tataouine', 'Médenine', 'Kassérine', 'Sidi Bouzid', 'Tozeur', 'Zaghouan', 'Kebili', 'Jendouba',
        ];

        // Initialize agents array with the two custom agents assigned to Radès
        const agents = [
            {
                agentID: 'agt_001abc',
                name: 'Anonyme',
                lastname: 'Test0',
                email: 'a@example.com',
                phone: '70717171',
                location: 'LocTest',
                supervisorID: null,
                delegationID: radesDelegation.delegationID,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                agentID: 'agt_002def',
                name: 'Sofien',
                lastname: 'Test1',
                email: 's@example.com',
                phone: '20031474',
                location: 'LocTest',
                supervisorID: null,
                delegationID: radesDelegation.delegationID,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        // Filter out custom agents with existing emails or phones
        const filteredAgents = agents.filter(
            agent => !existingEmails.has(agent.email) && !existingPhones.has(agent.phone)
        );

        // Track agent count per delegation
        const delegationAgentCount = new Map(delegations.map(d => [d.delegationID, 0]));
        delegationAgentCount.set(radesDelegation.delegationID, 2); // Radès starts with 2 agents

        // Add custom agents to email and phone sets
        filteredAgents.forEach(agent => {
            existingEmails.add(agent.email);
            existingPhones.add(agent.phone);
        });

        // Ensure each delegation has at least 3 agents
        for (const delegation of delegations) {
            const currentCount = delegationAgentCount.get(delegation.delegationID);
            const agentsNeeded = 3 - currentCount; // Minimum 3 agents

            for (let i = 0; i < agentsNeeded; i++) {
                const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}${Math.floor(Math.random() * 1000)}@example.com`;

                // Skip if email already exists
                if (existingEmails.has(email)) {
                    i--; // Retry this iteration
                    continue;
                }

                // Generate unique phone number
                let phone;
                do {
                    phone = `${Math.floor(10000000 + Math.random() * 90000000)}`;
                } while (existingPhones.has(phone));

                const street = streets[Math.floor(Math.random() * streets.length)];
                const city = cities[Math.floor(Math.random() * cities.length)];
                const address = `${street}, ${city}, Tunisia`;

                filteredAgents.push({
                    agentID: `agt_${nanoid(6)}`,
                    name: firstName,
                    lastname: lastName,
                    email: email,
                    phone: phone,
                    location: address,
                    supervisorID: null,
                    delegationID: delegation.delegationID,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                existingEmails.add(email);
                existingPhones.add(phone);
                delegationAgentCount.set(
                    delegation.delegationID,
                    delegationAgentCount.get(delegation.delegationID) + 1
                );
            }
        }

        // Calculate target total agents for average of ~4 per delegation
        const targetTotalAgents = Math.round(delegations.length * 4); // Aim for average of 4
        let remainingCount = targetTotalAgents - filteredAgents.length;

        // Add additional agents to reach target, respecting max 6 per delegation
        while (remainingCount > 0) {
            // Find delegations with less than 6 agents
            const availableDelegations = delegations.filter(
                d => delegationAgentCount.get(d.delegationID) < 6
            );

            if (availableDelegations.length === 0) {
                console.log('No delegations available with less than 6 agents.');
                break;
            }

            // Prioritize delegations with fewer agents to balance distribution
            availableDelegations.sort((a, b) => {
                const countA = delegationAgentCount.get(a.delegationID);
                const countB = delegationAgentCount.get(b.delegationID);
                return countA - countB;
            });

            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}${Math.floor(Math.random() * 1000)}@example.com`;

            // Skip if email already exists
            if (existingEmails.has(email)) {
                continue;
            }

            // Generate unique phone number
            let phone;
            do {
                phone = `${Math.floor(10000000 + Math.random() * 90000000)}`;
            } while (existingPhones.has(phone));

            const randomDelegation = availableDelegations[0]; // Pick delegation with fewest agents
            const street = streets[Math.floor(Math.random() * streets.length)];
            const city = cities[Math.floor(Math.random() * cities.length)];
            const address = `${street}, ${city}, Tunisia`;

            filteredAgents.push({
                agentID: `agt_${nanoid(6)}`,
                name: firstName,
                lastname: lastName,
                email: email,
                phone: phone,
                location: address,
                supervisorID: null,
                delegationID: randomDelegation.delegationID,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Update agent count for the selected delegation
            delegationAgentCount.set(
                randomDelegation.delegationID,
                delegationAgentCount.get(randomDelegation.delegationID) + 1
            );

            existingEmails.add(email);
            existingPhones.add(phone);
            remainingCount--;
        }

        // Insert agents into the database
        if (filteredAgents.length > 0) {
            await Agent.bulkCreate(filteredAgents, { validate: true });
            console.log(`Successfully seeded ${filteredAgents.length} agents.`);
        } else {
            console.log('No new agents to seed; all emails or phones already exist.');
        }

        // Log agent distribution for verification
        console.log('Agent distribution per delegation:');
        let totalAgents = 0;
        for (const [delegationID, count] of delegationAgentCount) {
            const delegation = delegations.find(d => d.delegationID === delegationID);
            console.log(`${delegation.nameFr}: ${count} agents`);
            totalAgents += count;
        }
        console.log(`Total agents: ${totalAgents}, Average per delegation: ${(totalAgents / delegations.length).toFixed(2)}`);

    } catch (error) {
        console.error('Error seeding agents:', error);
        throw error;
    }
}

module.exports = seedAgents;