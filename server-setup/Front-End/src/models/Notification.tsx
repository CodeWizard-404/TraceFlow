interface Notification {
  id: number;
  message: string;
  type: "Info" | "Warning" | "Error";
  timestamp: string;
}

export default Notification;
