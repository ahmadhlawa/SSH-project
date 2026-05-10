import { io } from "socket.io-client";
import { API_URL } from "./api";

export function createSocket() {
  return io(API_URL, {
    transports: ["websocket", "polling"]
  });
}
