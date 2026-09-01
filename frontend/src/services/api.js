import axios from "axios";

// Create an Axios instance with a base URL and default headers for API requests
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the authentication token in the headers of each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("leadflow_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
},
  (error) => Promise.reject(error)
);

export default api;
