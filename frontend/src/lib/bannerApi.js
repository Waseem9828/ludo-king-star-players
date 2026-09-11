import { apiRequest } from "./apiClient.js";

export function getBanners() {
  return apiRequest("/banners");
}
