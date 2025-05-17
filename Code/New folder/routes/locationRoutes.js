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

// Users fetching routes
router.get('/regions/user/:userID', requirePermission('access_regions_by_user'), LocationController.getRegionsByUser);
router.get('/governorates/user/:userID', requirePermission('access_governorates_by_user'), LocationController.getGovernoratesByUser);
router.get('/delegations/user/:userID', requirePermission('access_delegations_by_user'), LocationController.getDelegationsByUser);

// Google Maps API routes
router.post('/geocode', requirePermission('access_google_maps'), LocationController.geocodeAddress);
router.post('/directions', requirePermission('access_google_maps'), LocationController.getDirections);
router.post('/places', requirePermission('access_google_maps'), LocationController.searchPlaces);
router.post('/distance-matrix', requirePermission('access_google_maps'), LocationController.getDistanceMatrix);
router.post('/place-details', requirePermission('access_google_maps'), LocationController.getPlaceDetails);
router.post('/nearby-places', requirePermission('access_google_maps'), LocationController.getNearbyPlaces);
router.post('/current-location', requirePermission('access_user_location'), LocationController.getCurrentUserLocation);
router.get('/user-location/:userId', requirePermission('access_user_location'), LocationController.getSpecificUserLocation);


router.get('/location-details', requirePermission('access_location_details_by_id'), LocationController.getLocationDetailsById);


module.exports = router;