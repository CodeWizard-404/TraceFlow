// import { useEffect, useState, useRef } from "react";
// import { Html5QrcodeScanner } from "html5-qrcode";
// import { useNavigate } from "react-router-dom";
// import { scanQR } from "../../apis/agentAPI";

// function QRScan() {
//   const [qrValue, setQrValue] = useState("");
//   const [errorMessage, setErrorMessage] = useState("");
//   const scannerRef = useRef<Html5QrcodeScanner | null>(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (!scannerRef.current) {
//       scannerRef.current = new Html5QrcodeScanner(
//         "reader",
//         {
//           qrbox: {
//             width: 250,
//             height: 250,
//           },
//           fps: 5,
//         },
//         false
//       );

//       scannerRef.current.render(success, error);
//     }
//     async function success(result: string) {
//       setQrValue(result);
//       const validateAgent = await scanQR(result);
//       if (validateAgent) {
//         scannerRef.current?.clear();
//         navigate(`/visit/idVisit/reason`);
//       } else {
//         setErrorMessage("Invalid Agent, please try again");
//       }
//     }
//     function error(e: string) {
//       if (e.includes("ChecksumException")) {
//         console.error("QR code is corrupted. Please scan a valid code.");
//       } else if (e.includes("FormatException")) {
//         console.error(
//           "Invalid QR code format. Please scan a standard QR code."
//         );
//       }
//     }
//   }, []);

//   return (
//     <>
//       {errorMessage && <p>{errorMessage}</p>}
//       <div id="reader"></div>
//     </>
//   );
// }

// export default QRScan;
