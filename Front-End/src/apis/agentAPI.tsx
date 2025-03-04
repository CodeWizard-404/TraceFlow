function scanQR(qrCode: string) {
  const phoneNumber = extractPhoneNumber(qrCode);
  return validateAgent(phoneNumber);
}

function extractPhoneNumber(qrCode: string) {
  const phoneNumber = extractTagValue(qrCode, "02");
  if (phoneNumber.length === 0) {
    throw new Error("Phone number not found in QR code");
  }
  return phoneNumber;
}

function extractTagValue(qrCode: string, tagNumber: string) {
  for (let index = 0; index < qrCode.length; ) {
    let tag = qrCode.substring(index, index + 2);
    index += 2;
    let tagLength = Number(qrCode.substring(index, index + 2));
    index += 2;
    let tagValue = qrCode.substring(index, index + tagLength);
    index += tagLength;

    if (tag === tagNumber) {
      return tagValue;
    }
  }
  return "";
}

async function validateAgent(phoneNumber: string) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/agents/phone/${phoneNumber}`
    );
    if (response.status === 404) {
      return false;
    }
    if (response.status === 200) {
      return true;
    }
    return false;
  } catch (error) {
    if (error instanceof Error) {
      console.error("There was a problem with the fetch operation!");
    }
    return false;
  }
}

async function getLocations() {
  try {
    const response = await fetch(`http://localhost:5000/api/agents/locations`);
    if (response.status === 200) {
      const data = await response.json();
      return data;
    }
    return [];
  } catch (error) {
    if (error instanceof Error) {
      console.error("There was a problem with the fetch operation!");
    }
    return [];
  }
}

async function getAgentsByLocation(location: string) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/agents/location?location=${location}`
    );
    if (response.status === 200) {
      const data = await response.json();
      return data;
    }
    return [];
  } catch (error) {
    if (error instanceof Error) {
      console.error("There was a problem with the fetch operation!");
    }
    return [];
  }
}

export { scanQR, getLocations, getAgentsByLocation };
