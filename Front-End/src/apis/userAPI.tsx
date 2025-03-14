import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { GetSupervisorByPhoneNumberResponse } from ".";

const userApi = axios.create({
  baseURL: `${BASE_URL}/user`,
  timeout: DEFAULT_TIMEOUT,
});

export const getSupervisorByPhone = async (
  phone: string
): Promise<GetSupervisorByPhoneNumberResponse> => {
  const response = await userApi.post<GetSupervisorByPhoneNumberResponse>(
    "/phone",
    { phone }
  );
  return response.data;
};
