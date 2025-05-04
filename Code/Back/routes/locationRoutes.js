const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const LocationController = require('../controllers/locationController');

// Routes for locations
router.get('/regions', requirePermission('access_regions'), LocationController.getAllRegions);
router.get('/governorates', requirePermission('access_governorates'), LocationController.getAllGovernorates);
router.get('/delegations', requirePermission('access_delegations'), LocationController.getAllDelegations);
router.get('/delegations/governorate', requirePermission('access_delegations_by_governorate'), LocationController.getDelegationsByGovernorate);
router.get('/governorates/region', requirePermission('access_governorates_by_region'), LocationController.getGovernorateByRegion);
router.get('/regions/governorate', requirePermission('access_regions_by_governorate'), LocationController.getRegionsByGovernorate);
router.get('/governorates/delegation', requirePermission('access_governorates_by_delegation'), LocationController.getGovernoratesByDelegation);

// get regions by user
router.get('/regions/user/:userID', requirePermission('access_regions_by_user'), LocationController.getRegionsByUser);
// get governorates by user
router.get('/governorates/user/:userID', requirePermission('access_governorates_by_user'), LocationController.getGovernoratesByUser);
// get delegations by user
router.get('/delegations/user/:userID', requirePermission('access_delegations_by_user'), LocationController.getDelegationsByUser);

module.exports = router;