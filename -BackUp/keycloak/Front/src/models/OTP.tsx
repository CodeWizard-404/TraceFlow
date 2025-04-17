interface OTP {
    otpID: string;
    code: string;
    expiresAt: string;
    createdAt: string;
    userID: string;
    agentID?: string;
}

export default OTP;