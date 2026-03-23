import { io } from "socket.io-client";

const SOCKET_URL = "https://api.collabzy.in/api";

export const socket = io(SOCKET_URL, {
  autoConnect: false,         // manually connect after login
  transports: ["websocket"],
  withCredentials: true,
});