export const API_BASE_URL = 'http://localhost:8000/api'; // Update this to match your local PHP server URL

export const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}/${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return await response.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
};
