const { expect } = require('chai');
const sinon = require('sinon');
const bcrypt = require('bcrypt');
const { User, Role, Permission, UserPermissionOverride } = require('../../models');
const UserService = require('../../services/userService');

describe('UserService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        sinon.restore(); // Reset all Sinon state
    });

    afterAll(async () => {
        const sequelize = require('../../models').sequelize; // Adjust path
        await sequelize.close();
    });

    describe('createUser', () => {
        it('should create a new user with valid data', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                firstname: 'John',
                lastname: 'Doe',
                phone: '1234567890',
            };
            const hashedPassword = 'hashedPassword123';

            sandbox.stub(bcrypt, 'hash').resolves(hashedPassword);
            sandbox.stub(User, 'create').resolves({
                get: () => ({
                    id: 1,
                    ...userData,
                    password: hashedPassword
                })
            });

            const result = await UserService.createUser(
                userData.email,
                userData.password,
                userData.firstname,
                userData.lastname,
                userData.phone,
            );

            const user = result.get(); // Extract plain data
            expect(user).to.have.property('id');
            expect(user.email).to.equal(userData.email);
            expect(user.firstname).to.equal(userData.firstname);
            expect(user.password).to.equal(hashedPassword);
        });

        it('should throw error when email is already registered', async () => {
            sandbox.stub(User, 'create').rejects(new Error('Email already exists'));

            try {
                await UserService.createUser(
                    'existing@example.com',
                    'password123',
                    'John',
                    'Doe',
                    '1234567890',
                    100
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Failed to create user: Email already exists');
            }
        });

        it('should throw error when required fields are missing', async () => {
            try {
                await UserService.createUser(
                    null,
                    'password123',
                    'John',
                    'Doe',
                    '1234567890',
                    100
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.exist;
            }
        });

        it('should hash password before saving', async () => {
            const password = 'password123';
            const hashedPassword = 'hashedPassword123';

            const hashStub = sandbox.stub(bcrypt, 'hash').resolves(hashedPassword);
            sandbox.stub(User, 'create').resolves({
                get: () => ({
                    id: 1,
                    password: hashedPassword
                })
            });

            await UserService.createUser(
                'test@example.com',
                password,
                'John',
                'Doe',
                '1234567890',
                100
            );

            expect(hashStub.calledWith(password)).to.be.true;
        });
    });
});