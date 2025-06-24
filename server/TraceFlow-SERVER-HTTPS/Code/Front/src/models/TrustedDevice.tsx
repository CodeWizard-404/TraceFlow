interface TrustedDevice {
    deviceID: string;
    userID: string;
    deviceToken: string;
    userAgent: string;
    status: 'active' | 'inactive';
    lastUsed: string;
    expiresAt: string;
}

export default TrustedDevice;