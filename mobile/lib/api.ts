const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // We need to pass the Clerk token in headers if required.
  // This will be handled in a hook or component where we have access to useAuth().
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }

  return response.json();
}
