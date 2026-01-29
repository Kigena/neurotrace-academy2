const API_URL = import.meta.env.VITE_API_URL || 'https://neurotrace-academy.onrender.com/api';

class ApiService {
    constructor() {
        this.timeout = 90000; // 90 seconds to handle Render cold starts
        this.maxRetries = 2;
    }

    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - server may be starting up. Please wait a moment and try again.');
            }
            throw error;
        }
    }

    /**
     * Parse error response
     */
    async handleErrorResponse(response) {
        let errorMessage = response.statusText;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
            // If can't parse JSON, use statusText
        }
        throw new Error(errorMessage);
    }

    async get(endpoint, params = {}) {
        const url = new URL(`${API_URL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await this.fetchWithTimeout(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            await this.handleErrorResponse(response);
        }

        return response.json();
    }

    async post(endpoint, data, retryCount = 0) {
        try {
            const response = await this.fetchWithTimeout(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            return response.json();
        } catch (error) {
            // Retry on network errors (cold start)
            if (retryCount < this.maxRetries && (error.message.includes('timeout') || error.message.includes('fetch'))) {
                console.log(`Retrying request (attempt ${retryCount + 1}/${this.maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between retries
                return this.post(endpoint, data, retryCount + 1);
            }
            throw error;
        }
    }

    async put(endpoint, data) {
        const response = await this.fetchWithTimeout(`${API_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            await this.handleErrorResponse(response);
        }

        return response.json();
    }
}

export default new ApiService();

