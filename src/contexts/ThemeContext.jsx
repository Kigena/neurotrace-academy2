import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme presets
export const THEMES = {
    light: {
        name: 'Light',
        colors: {
            primary: '#0e7c6b',      // accent (deep teal)
            primaryHover: '#0c6559',
            background: '#f4f7f6',   // paper
            surface: '#ffffff',
            text: '#14211f',         // ink
            textSecondary: '#5b6b68', // muted
            border: '#d9e2e0',       // line
            success: '#10b981',      // green-500
            error: '#ef4444',        // red-500
            warning: '#f59e0b',      // amber-500
        }
    },
    dark: {
        name: 'Dark',
        // The Focus Drills dark tokens. The full palette swap lives in
        // index.css under :root[data-theme="dark"].
        colors: {
            primary: '#3fc2a8',      // accent
            primaryHover: '#5fd0b8',
            background: '#0f1716',   // paper
            surface: '#16211f',      // card
            text: '#e3ece9',         // ink
            textSecondary: '#97a8a4', // muted
            border: '#2a3836',       // line
            success: '#5fd38a',
            error: '#ff8a7d',
            warning: '#f2b467',
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

// Dark (the Focus Drills look) is the default until a member picks another theme.
// The storage keys were renamed (v2) when dark became the default, so theme choices
// saved before the redesign (light, Medical Blue, ...) no longer override it.
export const DEFAULT_THEME = 'dark';

function savedTheme() {
    try { return localStorage.getItem('neurolinea_theme_v2') || DEFAULT_THEME; } catch { return DEFAULT_THEME; }
}

function savedCustomColors() {
    try {
        const raw = localStorage.getItem('neurolinea_custom_colors_v2');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export const ThemeProvider = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState(savedTheme);
    const [customColors, setCustomColors] = useState(savedCustomColors);

    // Apply theme CSS variables whenever theme changes
    useEffect(() => {
        const colors = customColors || THEMES[currentTheme]?.colors || THEMES.light.colors;

        // Apply CSS variables to root; data-theme switches the full palette (index.css).
        const root = document.documentElement;
        root.dataset.theme = currentTheme;
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
        localStorage.setItem('neurolinea_theme_v2', themeName);
        localStorage.removeItem('neurolinea_custom_colors_v2');
    };

    const setCustomTheme = (colors) => {
        setCustomColors(colors);
        setCurrentTheme('custom');
        localStorage.setItem('neurolinea_theme_v2', 'custom');
        localStorage.setItem('neurolinea_custom_colors_v2', JSON.stringify(colors));
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
