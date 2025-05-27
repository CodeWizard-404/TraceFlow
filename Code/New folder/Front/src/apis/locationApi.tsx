import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
    AllRegionsResponse,
    AllGovernoratesResponse,
    AllDelegationsResponse,
    DelegationsByGovernorateResponse,
    GovernoratesByRegionResponse,
    RegionsByGovernorateResponse,
    GovernoratesByDelegationResponse,
    RegionsByUserResponse,
    GovernoratesByUserResponse,
    DelegationsByUserResponse,
    GeocodeResponse,
    DirectionsResponse,
    PlacesResponse,
    DistanceMatrixResponse,
    LocationDetailsResponse,
} from "./index";

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    if (error instanceof AxiosError) {
        const axiosError = error as AxiosError;
        if (axiosError.response) return axiosError.message;
        switch (axiosError.status) {
            case 400: return "Invalid request. Please check your input and try again.";
            case 401: return "Authentication failed. Please log in again.";
            case 403: return "You don’t have permission to perform this action.";
            case 404: return "Resource not found.";
            case 429: return "API quota exceeded. Please try again later.";
            case 500: return "Something went wrong on our end. Please try again later.";
            default: return defaultMessage;
        }
    }
    return defaultMessage;
};

export const getLocationDetailsById = async (id: String): Promise<LocationDetailsResponse> => {
    try {
        const response = await api.get<LocationDetailsResponse>(`/locations/location-details?id=${id}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch location details."));
    }
};

export const getAllRegions = async (): Promise<AllRegionsResponse> => {
    try {
        const response = await api.get<AllRegionsResponse>("/locations/regions");
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch regions."));
    }
};

export const getAllGovernorates = async (): Promise<AllGovernoratesResponse> => {
    try {
        const response = await api.get<AllGovernoratesResponse>("/locations/governorates");
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch governorates."));
    }
};

export const getAllDelegations = async (): Promise<AllDelegationsResponse> => {
    try {
        const response = await api.get<AllDelegationsResponse>("/locations/delegations");
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch delegations."));
    }
};

// Filtered retrieval routes
export const getDelegationsByGovernorate = async (governorateID: string): Promise<DelegationsByGovernorateResponse> => {
    try {
        if (!governorateID) throw new Error("Governorate ID is required.");
        const response = await api.get<DelegationsByGovernorateResponse>(`/locations/delegations/governorate?governorateID=${governorateID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch delegations by governorate."));
    }
};

export const getGovernoratesByRegion = async (regionID: string): Promise<GovernoratesByRegionResponse> => {
    try {
        if (!regionID) throw new Error("Region ID is required.");
        const response = await api.get<GovernoratesByRegionResponse>(`/locations/governorates/region?regionID=${regionID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch governorates by region."));
    }
};

export const getGovernoratesByDelegation = async (delegationID: string): Promise<GovernoratesByDelegationResponse> => {
    try {
        if (!delegationID) throw new Error("Delegation ID is required.");
        const response = await api.get<GovernoratesByDelegationResponse>(`/locations/governorates/delegation?delegationID=${delegationID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch governorates by delegation."));
    }
};

export const getRegionsByGovernorate = async (governorateID: string): Promise<RegionsByGovernorateResponse> => {
    try {
        if (!governorateID) throw new Error("Governorate ID is required.");
        const response = await api.get<RegionsByGovernorateResponse>(`/locations/regions/governorate?governorateID=${governorateID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch regions by governorate."));
    }
};

// User-specific retrieval routes
export const getRegionsByUser = async (userID: string): Promise<RegionsByUserResponse> => {
    try {
        const response = await api.get<RegionsByUserResponse>(`/locations/regions/user/${userID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch regions by user."));
    }
};

export const getGovernoratesByUser = async (userID: string): Promise<GovernoratesByUserResponse> => {
    try {
        const response = await api.get<GovernoratesByUserResponse>(`/locations/governorates/user/${userID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch governorates by user."));
    }
};

export const getDelegationsByUser = async (userID: string): Promise<DelegationsByUserResponse> => {
    try {
        const response = await api.get<DelegationsByUserResponse>(`/locations/delegations/user/${userID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch delegations by user."));
    }
};

// Google Maps API methods
export const getGeocode = async (address: string): Promise<GeocodeResponse> => {
    try {
        if (!address) throw new Error("Address is required.");
        const response = await api.post<GeocodeResponse>("/locations/geocode", { address });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to geocode address."));
    }
};

export const getDirections = async (
    origin: string,
    destination: string,
    mode: string = 'driving',
    waypoints?: Array<{ location: string; stopover: boolean }>,
    optimizeWaypoints: boolean = false
): Promise<DirectionsResponse> => {
    try {
        if (!origin || !destination) throw new Error("Origin and destination are required.");
        const response = await api.post<DirectionsResponse>("/locations/directions", {
            origin,
            destination,
            mode,
            waypoints,
            optimizeWaypoints,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to get directions."));
    }
};

export const updateUserLocation = async (userId: string, coordinates: { lat: number; lng: number }): Promise<{
    userId: string;
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
}> => {
    try {
        const response = await api.post('/locations/update-location', { userId, ...coordinates });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to update user location.'));
    }
};


export const searchPlaces = async (query: string, location?: { lat: number; lng: number }, radius: number = 5000): Promise<PlacesResponse> => {
    try {
        if (!query) throw new Error("Query is required.");
        const response = await api.post<PlacesResponse>("/locations/places", { query, location, radius });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to search places."));
    }
};

export const getDistanceMatrix = async (origins: string[], destinations: string[], mode: string = 'driving'): Promise<DistanceMatrixResponse> => {
    try {
        if (!origins.length || !destinations.length) throw new Error("Origins and destinations are required.");
        const response = await api.post<DistanceMatrixResponse>("/locations/distance-matrix", { origins, destinations, mode });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to get distance matrix."));
    }
};

// Export all functions
export default {
    getAllRegions,
    getAllGovernorates,
    getAllDelegations,
    getDelegationsByGovernorate,
    getGovernoratesByRegion,
    getGovernoratesByDelegation,
    getRegionsByGovernorate,
    getRegionsByUser,
    getGovernoratesByUser,
    getDelegationsByUser,
    getGeocode,
    getDirections,
    searchPlaces,
    getDistanceMatrix,
};