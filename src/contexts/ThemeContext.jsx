import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme presets
export const THEMES = {
    light: {
        name: 'Light',
        colors: {
            primary: '#2563eb',      // blue-600
            primaryHover: '#1d4ed8', // blue-700
            background: '#ffffff',
            surface: '#f8fafc',      // slate-50
            text: '#0f172a',         // slate-900
            textSecondary: '#475569', // slate-600
            border: '#cbd5e1',       // slate-300
            success: '#10b981',      // green-500
            error: '#ef4444',        // red-500
            warning: '#f59e0b',      // amber-500
        }
    },
    dark: {
        name: 'Dark',
        colors: {
            primary: '#3b82f6',      // blue-500
            primaryHover: '#2563eb', // blue-600
            background: '#0f172a',   // slate-900
            surface: '#1e293b',      // slate-800
            text: '#f1f5f9',         // slate-100
            textSecondary: '#cbd5e1', // slate-300
            border: '#334155',       // slate-700
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
        }
    },
    blue: {
        name: 'Medical Blue',
        colors: {
            primary: '#0ea5e9',      // sky-500
            primaryHover: '#0284c7', // sky-600
            background: '#f0f9ff',   // sky-50
            surface: '#ffffff',
            text: '#0c4a6e',         // sky-900
            textSecondary: '#0369a1', // sky-700
            border: '#7dd3fc',       // sky-300
            success: '#14b8a6',      // teal-500
            error: '#dc2626',
            warning: '#f59e0b',
        }
    },
    green: {
        name: 'Nature',
        colors: {
            primary: '#059669',      // emerald-600
            primaryHover: '#047857', // emerald-700
            background: '#f0fdf4',   // green-50
            surface: '#ffffff',
            text: '#064e3b',         // emerald-900
            textSecondary: '#065f46', // emerald-800
            border: '#6ee7b7',       // emerald-300
            success: '#10b981',
            error: '#dc2626',
            warning: '#f59e0b',
        }
    },
    purple: {
        name: 'Neuroscience',
        colors: {
            primary: '#9333ea',      // purple-600
            primaryHover: '#7e22ce', // purple-700
            background: '#faf5ff',   // purple-50
            surface: '#ffffff',
            text: '#3b0764',         // purple-950
            textSecondary: '#581c87', // purple-900
            border: '#d8b4fe',       // purple-300
            success: '#10b981',
            error: '#dc2626',
            warning: '#f59e0b',
        }
    }
};

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState('light');
    const [customColors, setCustomColors] = useState(null);

    // Load theme from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('neurotrace_theme');
        const savedCustomColors = localStorage.getItem('neurotrace_custom_colors');

        if (savedTheme) {
            setCurrentTheme(savedTheme);
        }
        if (savedCustomColors) {
            try {
                setCustomColors(JSON.parse(savedCustomColors));
            } catch (e) {
                console.error('Failed to parse custom colors:', e);
            }
        }
    }, []);

    // Apply theme CSS variables whenever theme changes
    useEffect(() => {
        const colors = customColors || THEMES[currentTheme]?.colors || THEMES.light.colors;

        // Apply CSS variables to root
        const root = document.documentElement;
        Object.entries(colors).forEach(([key, value]) => {
            root.style.setProperty(`--color-${key}`, value);
        });

        // Add transition class
        root.classList.add('theme-transitioning');
        setTimeout(() => {
            root.classList.remove('theme-transitioning');
        }, 300);
    }, [currentTheme, customColors]);

    const changeTheme = (themeName) => {
        setCurrentTheme(themeName);
        setCustomColors(null);
        localStorage.setItem('neurotrace_theme', themeName);
        localStorage.removeItem('neurotrace_custom_colors');
    };

    const setCustomTheme = (colors) => {
        setCustomColors(colors);
        setCurrentTheme('custom');
        localStorage.setItem('neurotrace_theme', 'custom');
        localStorage.setItem('neurotrace_custom_colors', JSON.stringify(colors));
    };

    const value = {
        currentTheme,
        customColors,
        themes: THEMES,
        changeTheme,
        setCustomTheme,
        activeColors: customColors || THEMES[currentTheme]?.colors || THEMES.light.colors,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
