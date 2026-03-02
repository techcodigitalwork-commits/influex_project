import { io } from "socket.io-client";

const SOCKET_URL = "http://54.252.201.93:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,         // manually connect after login
  transports: ["websocket"],
  withCredentials: true,
});