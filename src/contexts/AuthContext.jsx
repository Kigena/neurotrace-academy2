import React, { createContext, useContext, useState, useEffect } from "react";
import authService from "../services/authService";

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Try to restore session on mount
        const restoredUser = authService.tryRestoreSession();
        if (restoredUser) {
            setUser(restoredUser);
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const loggedInUser = await authService.login(email, password);
        setUser(loggedInUser);
        return loggedInUser;
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const createUser = async (name, email, password) => {
        const newUser = await authService.createUser(name, email, password);
        setUser(newUser); // users are auto-logged in by service, but we update context
        return newUser;
    };

    const getAllUsers = () => {
        return authService.getUsers();
    };

    const updateUser = (updatedUserData) => {
        setUser(updatedUserData);
        // Also update in storage
        authService.updateUserInStorage(updatedUserData);
    };

    const value = {
        user,
        loading,
        login,
        logout,
        createUser,
        getAllUsers,
        updateUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
