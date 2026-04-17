import { hostname, userInfo } from "node:os";

export function getHostname(): string {
  try {
    return hostname();
  } catch {
    return "unknown";
  }
}

export function getOsUser(): string {
  try {
    return userInfo().username;
  } catch {
    return "unknown";
  }
}
