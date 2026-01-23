import apiService from "./apiService";
import storageService from "./storageService";

/**
 * Auth Service
 * Manages user profiles and active session
 * Now connects to Backend API
 */

const SESSION_KEY = "neurotrace_active_session_v1";

class AuthService {
    constructor() {
        this.currentUser = null;
        this.tryRestoreSession();
    }

    /**
     * Restore session from ID
     */
    tryRestoreSession() {
        // Optimistic restore from local cache to avoid flicker
        // Real validation would happen on first API call
        const session = storageService.constructor.getGlobalItem(SESSION_KEY);
        if (session && session.user) {
            this.currentUser = session.user;
            storageService.setUserId(session.user._id || session.user.id);
            return session.user;
        }
        return null;
    }

    /**
     * Helper: Hash password using Web Crypto API
     * (We keep this client-side hashing to match the schema expected by new backend which expects pre-hashed/raw password logic)
     * Ideally we'd send raw password over HTTPS and hash on server, but to minimize friction we keep the logic similar but send to API.
     */
    async _hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Create a new user profile with email and password
     */
    async createUser(name, email, password) {
        const passwordHash = await this._hashPassword(password);

        try {
            const user = await apiService.post('/auth/register', {
                name,
                email,
                passwordHash
            });
            return this._setSession(user);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Login with email and password
     */
    async login(email, password) {
        const passwordHash = await this._hashPassword(password);

        try {
            const user = await apiService.post('/auth/login', {
                email,
                passwordHash
            });
            return this._setSession(user);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Internal: Set active session
     */
    _setSession(user) {
        // Normalize ID (Mongo uses _id)
        const userId = user._id || user.id;
        user.id = userId; // Ensure .id exists for frontend compatibility

        this.currentUser = user;
        storageService.setUserId(userId);

        // Save minimal session info
        storageService.constructor.setGlobalItem(SESSION_KEY, {
            userId: userId,
            user: user
        });

        return user;
    }

    /**
     * Logout
     */
    logout() {
        this.currentUser = null;
        storageService.setUserId(null);
        storageService.constructor.setGlobalItem(SESSION_KEY, null);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }
}

export default new AuthService();
