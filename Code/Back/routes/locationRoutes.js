const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const LocationController = require('../controllers/locationController');

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Endpoints for managing regions, governorates, delegations, and Google Maps-related operations
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: accessToken
 *   schemas:
 *     Region:
 *       type: object
 *       properties:
 *         regionID:
 *           type: string
 *           description: Unique identifier for the region
 *         name:
 *           type: string
 *           description: Region name in default language
 *         nameAr:
 *           type: string
 *           description: Region name in Arabic
 *         nameFr:
 *           type: string
 *           description: Region name in French
 *     Governorate:
 *       type: object
 *       properties:
 *         governorateID:
 *           type: string
 *           description: Unique identifier for the governorate
 *         name:
 *           type: string
 *           description: Governorate name in default language
 *         nameAr:
 *           type: string
 *           description: Governorate name in Arabic
 *         nameFr:
 *           type: string
 *           description: Governorate name in French
 *         regionID:
 *           type: string
 *           description: ID of the associated region
 *         Region:
 *           $ref: '#/components/schemas/Region'
 *     Delegation:
 *       type: object
 *       properties:
 *         delegationID:
 *           type: string
 *           description: Unique identifier for the delegation
 *         name:
 *           type: string
 *           description: Delegation name in default language
 *         nameAr:
 *           type: string
 *           description: Delegation name in Arabic
 *         nameFr:
 *           type: string
 *           description: Delegation name in French
 *         governorateID:
 *           type: string
 *           description: ID of the associated governorate
 *         Governorate:
 *           $ref: '#/components/schemas/Governorate'
 *     LocationDetails:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *         address:
 *           type: string
 *           description: Full address string
 *         idInfo:
 *           type: string
 *           description: Name of the location entity
 *         addressInfo:
 *           type: object
 *           properties:
 *             region:
 *               type: string
 *               description: Region name
 *             governorate:
 *               type: string
 *               description: Governorate name
 *             delegation:
 *               type: string
 *               description: Delegation name
 *             regionID:
 *               type: string
 *               description: Region ID
 *             governorateID:
 *               type: string
 *               description: Governorate ID
 *             delegationID:
 *               type: string
 *               description: Delegation ID
 *     GeocodeResponse:
 *       type: object
 *       properties:
 *         latitude:
 *           type: number
 *           description: Latitude of the geocoded location
 *         longitude:
 *           type: number
 *           description: Longitude of the geocoded location
 *         formattedAddress:
 *           type: string
 *           description: Formatted address from Google Maps
 *     DirectionsResponse:
 *       type: object
 *       properties:
 *         distance:
 *           type: number
 *           description: Total distance in kilometers
 *         duration:
 *           type: number
 *           description: Total duration in minutes
 *         steps:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               instruction:
 *                 type: string
 *                 description: HTML instruction for the step
 *               distance:
 *                 type: string
 *                 description: Distance for the step
 *               duration:
 *                 type: string
 *                 description: Duration for the step
 *               start_location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *               polyline:
 *                 type: string
 *                 description: Encoded polyline for the step
 *         polyline:
 *           type: string
 *           description: Encoded overview polyline
 *         waypointOrder:
 *           type: array
 *           items:
 *             type: integer
 *           description: Order of waypoints if optimized
 *         trafficSegments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               legIndex:
 *                 type: integer
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     polyline:
 *                       type: string
 *                     trafficCondition:
 *                       type: string
 *                       enum: [clear, moderate, heavy, unknown]
 *                     color:
 *                       type: string
 *                     distance:
 *                       type: string
 *                     duration:
 *                       type: string
 *                     instruction:
 *                       type: string
 *               distance:
 *                 type: number
 *               duration:
 *                 type: number
 *         optimizedPoints:
 *           type: array
 *           items:
 *             type: string
 *           description: Optimized waypoint locations
 *     PlaceAutocomplete:
 *       type: object
 *       properties:
 *         description:
 *           type: string
 *           description: Full description of the place
 *         placeId:
 *           type: string
 *           description: Google Maps Place ID
 *         structuredFormatting:
 *           type: object
 *           description: Structured formatting of the place
 *     DistanceMatrixElement:
 *       type: object
 *       properties:
 *         distance:
 *           type: number
 *           description: Distance in kilometers
 *         duration:
 *           type: number
 *           description: Duration in minutes
 *         status:
 *           type: string
 *           description: Status of the element
 *     PlaceDetails:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the place
 *         address:
 *           type: string
 *           description: Formatted address
 *         latitude:
 *           type: number
 *           description: Latitude of the place
 *         longitude:
 *           type: number
 *           description: Longitude of the place
 *     NearbyPlace:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the place
 *         placeId:
 *           type: string
 *           description: Google Maps Place ID
 *         latitude:
 *           type: number
 *           description: Latitude of the place
 *         longitude:
 *           type: number
 *           description: Longitude of the place
 *         types:
 *           type: array
 *           items:
 *             type: string
 *           description: Types of the place
 *     UserLocation:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: ID of the user
 *         latitude:
 *           type: number
 *           description: Latitude of the user's location
 *         longitude:
 *           type: number
 *           description: Longitude of the user's location
 *         address:
 *           type: string
 *           description: Formatted address of the user's location
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the location update
 *     UpdateLocationRequest:
 *       type: object
 *       required:
 *         - userId
 *         - lat
 *         - lng
 *       properties:
 *         userId:
 *           type: string
 *           description: ID of the user
 *         lat:
 *           type: number
 *           description: Latitude of the new location
 *         lng:
 *           type: number
 *           description: Longitude of the new location
 *     GeocodeRequest:
 *       type: object
 *       required:
 *         - address
 *       properties:
 *         address:
 *           type: string
 *           description: Address to geocode
 *     DirectionsRequest:
 *       type: object
 *       required:
 *         - origin
 *         - destination
 *       properties:
 *         origin:
 *           type: string
 *           description: Starting point for directions
 *         destination:
 *           type: string
 *           description: Ending point for directions
 *         mode:
 *           type: string
 *           enum: [driving, walking, bicycling, transit]
 *           description: Travel mode
 *         waypoints:
 *           type: array
 *           items:
 *             type: string
 *           description: List of waypoints
 *         optimizeWaypoints:
 *           type: boolean
 *           description: Whether to optimize the order of waypoints
 *     PlacesRequest:
 *       type: object
 *       required:
 *         - query
 *       properties:
 *         query:
 *           type: string
 *           description: Search query for places
 *         location:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *           description: Optional location to center the search
 *         radius:
 *           type: number
 *           description: Search radius in meters
 *     DistanceMatrixRequest:
 *       type: object
 *       required:
 *         - origins
 *         - destinations
 *       properties:
 *         origins:
 *           type: array
 *           items:
 *             type: string
 *           description: List of origin points
 *         destinations:
 *           type: array
 *           items:
 *             type: string
 *           description: List of destination points
 *         mode:
 *           type: string
 *           enum: [driving, walking, bicycling, transit]
 *           description: Travel mode
 *     PlaceDetailsRequest:
 *       type: object
 *       required:
 *         - placeId
 *       properties:
 *         placeId:
 *           type: string
 *           description: Google Maps Place ID
 *     NearbyPlacesRequest:
 *       type: object
 *       required:
 *         - lat
 *         - lng
 *       properties:
 *         lat:
 *           type: number
 *           description: Latitude of the search center
 *         lng:
 *           type: number
 *           description: Longitude of the search center
 *         radius:
 *           type: number
 *           description: Search radius in meters
 *         type:
 *           type: string
 *           description: Type of place to search for
 *     CurrentLocationRequest:
 *       type: object
 *       required:
 *         - lat
 *         - lng
 *       properties:
 *         lat:
 *           type: number
 *           description: Latitude of the current location
 *         lng:
 *           type: number
 *           description: Longitude of the current location

/**
 * @swagger
 * /api/locations/regions:
 *   get:
 *     summary: Get all regions
 *     description: Retrieves a list of all regions. Requires `access_regions` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved regions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Region'
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/regions', requirePermission('access_regions'), LocationController.getAllRegions);

/**
 * @swagger
 * /api/locations/governorates:
 *   get:
 *     summary: Get all governorates
 *     description: Retrieves a list of all governorates with associated regions. Requires `access_governorates` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved governorates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Governorate'
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/governorates', requirePermission('access_governorates'), LocationController.getAllGovernorates);

/**
 * @swagger
 * /api/locations/delegations:
 *   get:
 *     summary: Get all delegations
 *     description: Retrieves a list of all delegations with associated governorates. Requires `access_delegations` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved delegations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Delegation'
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/delegations', requirePermission('access_delegations'), LocationController.getAllDelegations);

/**
 * @swagger
 * /api/locations/delegations/governorate:
 *   get:
 *     summary: Get delegations by governorate
 *     description: Retrieves delegations for a specific governorate. Requires `access_delegations_by_governorate` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: governorateID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the governorate
 *     responses:
 *       200:
 *         description: Successfully retrieved delegations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Delegation'
 *       400:
 *         description: Missing governorateID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/delegations/governorate', requirePermission('access_delegations_by_governorate'), LocationController.getDelegationsByGovernorate);

/**
 * @swagger
 * /api/locations/governorates/region:
 *   get:
 *     summary: Get governorates by region
 *     description: Retrieves governorates for a specific region. Requires `access_governorates_by_region` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: regionID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the region
 *     responses:
 *       200:
 *         description: Successfully retrieved governorates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Governorate'
 *       400:
 *         description: Missing regionID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/governorates/region', requirePermission('access_governorates_by_region'), LocationController.getGovernorateByRegion);

/**
 * @swagger
 * /api/locations/regions/governorate:
 *   get:
 *     summary: Get regions by governorate
 *     description: Retrieves the region associated with a specific governorate. Requires `access_regions_by_governorate` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: governorateID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the governorate
 *     responses:
 *       200:
 *         description: Successfully retrieved regions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Region'
 *       400:
 *         description: Missing governorateID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/regions/governorate', requirePermission('access_regions_by_governorate'), LocationController.getRegionsByGovernorate);

/**
 * @swagger
 * /api/locations/governorates/delegation:
 *   get:
 *     summary: Get governorates by delegation
 *     description: Retrieves the governorate associated with a specific delegation. Requires `access_governorates_by_delegation` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: delegationID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delegation
 *     responses:
 *       200:
 *         description: Successfully retrieved governorates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Governorate'
 *       400:
 *         description: Missing delegationID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/governorates/delegation', requirePermission('access_governorates_by_delegation'), LocationController.getGovernoratesByDelegation);

/**
 * @swagger
 * /api/locations/regions/user/{userID}:
 *   get:
 *     summary: Get regions assigned to a user
 *     description: Retrieves regions assigned to a specific user. Requires `access_regions_by_user` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved regions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Region'
 *       400:
 *         description: Missing userID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Regions not found
 *       500:
 *         description: Internal server error
 */
router.get('/regions/user/:userID', requirePermission('access_regions_by_user'), LocationController.getRegionsByUser);

/**
 * @swagger
 * /api/locations/governorates/user/{userID}:
 *   get:
 *     summary: Get governorates assigned to a user
 *     description: Retrieves governorates assigned to a specific user. Requires `access_governorates_by_user` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved governorates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Governorate'
 *       400:
 *         description: Missing userID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Governorates not found
 *       500:
 *         description: Internal server error
 */
router.get('/governorates/user/:userID', requirePermission('access_governorates_by_user'), LocationController.getGovernoratesByUser);

/**
 * @swagger
 * /api/locations/delegations/user/{userID}:
 *   get:
 *     summary: Get delegations assigned to a user
 *     description: Retrieves delegations assigned to a specific user. Requires `access_delegations_by_user` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved delegations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Delegation'
 *       400:
 *         description: Missing userID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Delegations not found
 *       500:
 *         description: Internal server error
 */
router.get('/delegations/user/:userID', requirePermission('access_delegations_by_user'), LocationController.getDelegationsByUser);

/**
 * @swagger
 * /api/locations/update-location:
 *   post:
 *     summary: Update user location
 *     description: Updates a user's location with provided coordinates. Requires `update_user_location` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLocationRequest'
 *     responses:
 *       200:
 *         description: Location updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserLocation'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/update-location', requirePermission('update_user_location'), LocationController.updateUserLocation);

/**
 * @swagger
 * /api/locations/geocode:
 *   post:
 *     summary: Geocode an address
 *     description: Converts an address to coordinates using Google Maps API. Requires `access_google_maps` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GeocodeRequest'
 *     responses:
 *       200:
 *         description: Successfully geocoded address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GeocodeResponse'
 *       400:
 *         description: Missing address
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/geocode', requirePermission('access_google_maps'), LocationController.geocodeAddress);

/**
 * @swagger
 * /api/locations/directions:
 *   post:
 *     summary: Get directions
 *     description: Retrieves directions between two points using Google Maps API. Requires `access_google_maps` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DirectionsRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved directions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectionsResponse'
 *       400:
 *         description: Missing origin or destination
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/directions', requirePermission('access_google_maps'), LocationController.getDirections);

/**
 * @swagger
 * /api/locations/places:
 *   post:
 *     summary: Search for places
 *     description: Searches for places using Google Maps Places API. Requires `access_google_maps` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlacesRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved places
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlaceAutocomplete'
 *       400:
 *         description: Missing query
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/places', requirePermission('access_google_maps'), LocationController.searchPlaces);

/**
 * @swagger
 * /api/locations/distance-matrix:
 *   post:
 *     summary: Get distance matrix
 *     description: Retrieves a distance matrix using Google Maps API. Requires `access_google_maps` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DistanceMatrixRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved distance matrix
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/DistanceMatrixElement'
 *       400:
 *         description: Missing origins or destinations
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/distance-matrix', requirePermission('access_google_maps'), LocationController.getDistanceMatrix);

/**
 * @swagger
 * /api/locations/place-details:
 *   post:
 *     summary: Get place details
 *     description: Retrieves details for a specific place using Google Maps API. Requires `access_google_maps` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlaceDetailsRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved place details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlaceDetails'
 *       400:
 *         description: Missing placeId
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/place-details', requirePermission('access_google_maps'), LocationController.getPlaceDetails);

/**
 * @swagger
 * /api/locations/nearby-places:
 *   post:
 *     summary: Get nearby places
 *     description: Retrieves nearby places using Google Maps API. Requires `access_google_maps` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NearbyPlacesRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved nearby places
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NearbyPlace'
 *       400:
 *         description: Missing latitude or longitude
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/nearby-places', requirePermission('access_google_maps'), LocationController.getNearbyPlaces);

/**
 * @swagger
 * /api/locations/current-location:
 *   post:
 *     summary: Get current user location
 *     description: Retrieves the current user's location based on provided coordinates. Requires `access_user_location` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurrentLocationRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved current location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserLocation'
 *       400:
 *         description: Missing latitude or longitude
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/current-location', requirePermission('access_user_location'), LocationController.getCurrentUserLocation);

/**
 * @swagger
 * /api/locations/user-location/{userId}:
 *   get:
 *     summary: Get specific user location
 *     description: Retrieves the location of a specific user. Requires `access_user_location` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserLocation'
 *       400:
 *         description: Missing userId
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/user-location/:userId', requirePermission('access_user_location'), LocationController.getSpecificUserLocation);

/**
 * @swagger
 * /api/locations/location-details:
 *   get:
 *     summary: Get location details by ID
 *     description: Retrieves detailed address information for a region, governorate, or delegation by ID. Requires `access_location_details_by_id` permission.
 *     tags: [Locations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the region, governorate, or delegation
 *     responses:
 *       200:
 *         description: Successfully retrieved location details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationDetails'
 *       400:
 *         description: Missing or invalid ID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Location not found
 *       500:
 *         description: Internal server error
 */
router.get('/location-details', requirePermission('access_location_details_by_id'), LocationController.getLocationDetailsById);

module.exports = router;