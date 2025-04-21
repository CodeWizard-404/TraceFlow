interface OTP {
    otpID: string;
    code: string;
    expiresAt: string;
    createdAt: string;
    used: boolean;
    userID?: string;
    agentID?: string;
}

export default OTP;