const { expect } = require('chai');
const sinon = require('sinon');
const { Checklist, Visit, VisitChecklist } = require('../../models');
const ChecklistService = require('../../services/checklistService');

describe('ChecklistService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should create ChecklistService instance', () => {
            const service = new ChecklistService();
            expect(service).to.be.instanceOf(ChecklistService);
        });

        it('should have access to required models', () => {
            expect(Checklist).to.exist;
            expect(Visit).to.exist;
            expect(VisitChecklist).to.exist;
        });
    });

    describe('model relationships', () => {
        it('should have Checklist model defined', () => {
            expect(Checklist).to.be.a('function');
        });

        it('should have Visit model defined', () => {
            expect(Visit).to.be.a('function');
        });

        it('should have VisitChecklist model defined', () => {
            expect(VisitChecklist).to.be.a('function');
        });
    });
});
