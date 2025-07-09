const { expect } = require('chai');
const sinon = require('sinon');
const { Permission } = require('../../models');
const PermissionService = require('../../services/permissionService');

describe('PermissionService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('createPermission', () => {
        it('should create a new permission with valid data', async () => {
            const permissionData = {
                name: 'TEST_PERMISSION',
                type: 'READ',
                className: 'TestClass',
                description: 'Test permission description'
            };
            const mockPermission = { id: 1, ...permissionData };
            sandbox.stub(Permission, 'create').resolves(mockPermission);

            const result = await PermissionService.createPermission(
                permissionData.name,
                permissionData.type,
                permissionData.className,
                permissionData.description
            );

            expect(result).to.deep.equal(mockPermission);
            expect(Permission.create.calledOnce).to.be.true;
            expect(Permission.create.firstCall.args[0]).to.deep.equal(permissionData);
        });

        it('should throw error when permission creation fails', async () => {
            const error = new Error('Database error');
            sandbox.stub(Permission, 'create').rejects(error);

            try {
                await PermissionService.createPermission('TEST', 'READ', 'Class', 'Description');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });

        it('should create permission with minimal required data', async () => {
            const permissionData = {
                name: 'MIN_PERMISSION',
                type: 'WRITE',
                className: 'MinClass'
            };
            const mockPermission = { id: 1, ...permissionData, description: null };
            sandbox.stub(Permission, 'create').resolves(mockPermission);

            const result = await PermissionService.createPermission(
                permissionData.name,
                permissionData.type,
                permissionData.className
            );

            expect(result).to.deep.equal(mockPermission);
            expect(Permission.create.calledOnce).to.be.true;
        });
    });
});
