const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export const api = {
  getHealth: () => request("/api/health"),
  getWorkers: () => request("/api/workers"),
  getWorker: (id) => request(`/api/workers/${id}`),
  getWorkerLogs: (id) => request(`/api/workers/${id}/logs`),
  getAlerts: () => request("/api/alerts"),
  sendHelmetReading: (reading) =>
    request("/api/helmet/readings", {
      method: "POST",
      body: JSON.stringify(reading)
    }),
  acknowledgeAlert: (id) => request(`/api/alerts/${id}/acknowledge`, { method: "POST" })
};

export { API_URL };
