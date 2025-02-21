import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import validateAgent from "../apis/api";

function QRScan() {
  const [qrValue, setQrValue] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        {
          qrbox: {
            width: 250,
            height: 250,
          },
          fps: 5,
        },
        false
      );

      scannerRef.current.render(success, error);
    }
    function success(result: string) {
      scannerRef.current?.clear();
      setQrValue(result);
      if (validateAgent(qrValue)) {
        navigate(`/visit/idVisit/reason`);
      } else {
        alert("Invalid Agent, please try again");
      }
    }
    function error(e: string) {
      if (e.includes("ChecksumException")) {
        console.error("QR code is corrupted. Please scan a valid code.");
      } else if (e.includes("FormatException")) {
        console.error(
          "Invalid QR code format. Please scan a standard QR code."
        );
      }
    }
  }, []);

  return <div id="reader"></div>;
}

export default QRScan;
