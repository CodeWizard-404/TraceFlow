const { expect } = require('chai');
const sinon = require('sinon');
const { Role } = require('../../models');
const RoleService = require('../../services/roleService');

describe('RoleService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('createRole', () => {
        it('should create a new role with valid data', async () => {
            const roleData = {
                name: 'TEST_ROLE',
                description: 'Test role description'
            };
            const mockRole = {
                id: 1,
                roleID: 'role_abc123',
                ...roleData
            };
            sandbox.stub(Role, 'findOrCreate').resolves([mockRole, true]);

            const result = await RoleService.createRole(
                roleData.name,
                roleData.description
            );

            expect(result).to.deep.equal(mockRole);
            expect(Role.findOrCreate.calledOnce).to.be.true;
            expect(Role.findOrCreate.firstCall.args[0].where).to.deep.equal({ name: roleData.name });
        });

        it('should throw error when role already exists', async () => {
            const existingRole = {
                id: 1,
                roleID: 'role_existing',
                name: 'EXISTING_ROLE',
                description: 'Existing role'
            };
            sandbox.stub(Role, 'findOrCreate').resolves([existingRole, false]);

            try {
                await RoleService.createRole('EXISTING_ROLE', 'New description');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('Failed to create role: Role already exists');
            }
        });

        it('should create role with minimal required data', async () => {
            const roleData = {
                name: 'MIN_ROLE'
            };
            const mockRole = {
                id: 1,
                roleID: 'role_min123',
                name: roleData.name,
                description: null
            };
            sandbox.stub(Role, 'findOrCreate').resolves([mockRole, true]);

            const result = await RoleService.createRole(roleData.name);

            expect(result).to.deep.equal(mockRole);
            expect(Role.findOrCreate.calledOnce).to.be.true;
        });

        it('should handle database errors during role creation', async () => {
            const error = new Error('Database connection error');
            sandbox.stub(Role, 'findOrCreate').rejects(error);

            try {
                await RoleService.createRole('TEST_ROLE', 'Test description');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('Failed to create role: Database connection error');
            }
        });
    });
});