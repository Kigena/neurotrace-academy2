import React, { useState } from 'react';
import { useTheme, THEMES } from '../contexts/ThemeContext';

const ThemeSelector = ({ isOpen, onClose }) => {
    const { currentTheme, changeTheme, setCustomTheme, customColors } = useTheme();
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [customColorValues, setCustomColorValues] = useState(customColors || {
        primary: '#2563eb',
        background: '#ffffff',
        text: '#0f172a',
    });

    if (!isOpen) return null;

    const handlePresetSelect = (themeName) => {
        changeTheme(themeName);
        setShowColorPicker(false);
        onClose();
    };

    const handleCustomColorChange = (colorKey, value) => {
        setCustomColorValues(prev => ({ ...prev, [colorKey]: value }));
    };

    const applyCustomTheme = () => {
        // Generate full color palette from basic colors
        const fullColors = {
            primary: customColorValues.primary,
            primaryHover: adjustBrightness(customColorValues.primary, -20),
            background: customColorValues.background,
            surface: adjustBrightness(customColorValues.background, -5),
            text: customColorValues.text,
            textSecondary: adjustBrightness(customColorValues.text, 40),
            border: adjustBrightness(customColorValues.background, -20),
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
        };
        setCustomTheme(fullColors);
        onClose();
    };

    // Helper to adjust color brightness
    const adjustBrightness = (hex, percent) => {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Theme Selector Modal */}
            <div className="fixed top-20 right-4 bg-white rounded-xl shadow-2xl z-50 w-96 max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">Choose Theme</h3>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Preset Themes */}
                    <div className="space-y-3 mb-6">
                        <h4 className="text-sm font-medium text-slate-600 mb-3">Preset Themes</h4>
                        {Object.entries(THEMES).map(([key, theme]) => (
                            <button
                                key={key}
                                onClick={() => handlePresetSelect(key)}
                                className={`w-full p-4 rounded-lg border-2 transition-all ${currentTheme === key && !customColors
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            <div
                                                className="w-6 h-6 rounded"
                                                style={{ backgroundColor: theme.colors.primary }}
                                            />
                                            <div
                                                className="w-6 h-6 rounded"
                                                style={{ backgroundColor: theme.colors.background }}
                                            />
                                            <div
                                                className="w-6 h-6 rounded"
                                                style={{ backgroundColor: theme.colors.text }}
                                            />
                                        </div>
                                        <span className="font-medium text-slate-900">{theme.name}</span>
                                    </div>
                                    {currentTheme === key && !customColors && (
                                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Custom Theme */}
                    <div className="border-t pt-6">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-slate-300 bg-white transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                    <span className="font-medium text-slate-900">Custom Colors</span>
                                </div>
                                <svg
                                    className={`w-5 h-5 text-slate-400 transition-transform ${showColorPicker ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {showColorPicker && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Primary Color
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={customColorValues.primary}
                                            onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                                            className="w-12 h-10 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={customColorValues.primary}
                                            onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                            placeholder="#2563eb"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Background Color
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={customColorValues.background}
                                            onChange={(e) => handleCustomColorChange('background', e.target.value)}
                                            className="w-12 h-10 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={customColorValues.background}
                                            onChange={(e) => handleCustomColorChange('background', e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                            placeholder="#ffffff"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Text Color
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={customColorValues.text}
                                            onChange={(e) => handleCustomColorChange('text', e.target.value)}
                                            className="w-12 h-10 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={customColorValues.text}
                                            onChange={(e) => handleCustomColorChange('text', e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                            placeholder="#0f172a"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={applyCustomTheme}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                                >
                                    Apply Custom Theme
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ThemeSelector;
