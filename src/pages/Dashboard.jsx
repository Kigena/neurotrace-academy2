import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/apiService';
import ProfileEditModal from '../components/ProfileEditModal';
import PasswordChangeModal from '../components/PasswordChangeModal';

function Dashboard() {
    const { user, updateUser } = useAuth();
    const { currentTheme, themes, changeTheme } = useTheme();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const sessions = await apiService.get(`/sessions?userId=${user.id}`);

            // Calculate statistics
            const totalQuizzes = sessions.length;
            const completedQuizzes = sessions.filter(s => s.endTime).length;

            let totalCorrect = 0;
            let totalQuestions = 0;
            let bestScore = 0;

            sessions.forEach(session => {
                if (session.answers) {
                    const correct = Object.values(session.answers).filter(a => a.isCorrect).length;
                    const total = Object.keys(session.answers).length;
                    totalCorrect += correct;
                    totalQuestions += total;

                    const scorePercent = total > 0 ? (correct / total) * 100 : 0;
                    if (scorePercent > bestScore) {
                        bestScore = scorePercent;
                    }
                }
            });

            const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

            setStats({
                totalQuizzes: completedQuizzes,
                totalQuestions,
                bestScore: Math.round(bestScore),
                overallAccuracy: Math.round(overallAccuracy),
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportData = async () => {
        try {
            const sessions = await apiService.get(`/sessions?userId=${user.id}`);
            const progress = await apiService.get(`/progress?userId=${user.id}`);

            const exportData = {
                user: {
                    name: user.name,
                    email: user.email,
                    createdAt: user.createdAt,
                },
                sessions,
                progress,
                exportedAt: new Date().toISOString(),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neurotrace-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export data:', error);
            alert('Failed to export data. Please try again.');
        }
    };

    const handleDeleteAccount = () => {
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            return;
        }

        if (!confirm('This will permanently delete all your quiz data and progress. Type DELETE to confirm.')) {
            return;
        }

        // TODO: Implement account deletion endpoint
        alert('Account deletion will be available soon. Please contact support for now.');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                        <p className="text-slate-600 mt-1">Manage your account and preferences</p>
                    </div>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-3xl font-bold">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Profile Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Profile</h2>
                    <button
                        onClick={() => setShowProfileEdit(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Edit Profile
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Name</span>
                        <span className="text-slate-900">{user?.name}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Email</span>
                        <span className="text-slate-900">{user?.email}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Member Since</span>
                        <span className="text-slate-900">
                            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between py-3">
                        <span className="text-slate-600 font-medium">Last Login</span>
                        <span className="text-slate-900">
                            {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Today'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Your Statistics</h2>

                {loading ? (
                    <div className="text-center py-8 text-slate-500">Loading statistics...</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600">{stats?.totalQuizzes || 0}</div>
                            <div className="text-sm text-slate-600 mt-1">Quizzes Taken</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-green-600">{stats?.bestScore || 0}%</div>
                            <div className="text-sm text-slate-600 mt-1">Best Score</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-purple-600">{stats?.overallAccuracy || 0}%</div>
                            <div className="text-sm text-slate-600 mt-1">Overall Accuracy</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-orange-600">{stats?.totalQuestions || 0}</div>
                            <div className="text-sm text-slate-600 mt-1">Questions Answered</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Preferences</h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                        <div>
                            <div className="font-medium text-slate-900">Theme</div>
                            <div className="text-sm text-slate-600">Current: {themes[currentTheme]?.name || 'Custom'}</div>
                        </div>
                        <div className="text-sm text-slate-500">Click palette icon in navbar to change</div>
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Security</h2>

                <div className="space-y-3">
                    <button
                        onClick={() => setShowPasswordChange(true)}
                        className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="font-medium text-slate-900">Change Password</span>
                        </div>
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Data & Privacy */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Data & Privacy</h2>

                <div className="space-y-3">
                    <button
                        onClick={handleExportData}
                        className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="text-left">
                                <div className="font-medium text-slate-900">Export Your Data</div>
                                <div className="text-sm text-slate-600">Download all your quiz data as JSON</div>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        className="w-full flex items-center justify-between p-4 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <div className="text-left">
                                <div className="font-medium text-red-600">Delete Account</div>
                                <div className="text-sm text-red-500">Permanently delete your account and all data</div>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Modals */}
            {showProfileEdit && (
                <ProfileEditModal
                    user={user}
                    onClose={() => setShowProfileEdit(false)}
                    onSave={(updatedUser) => {
                        updateUser(updatedUser);
                        setShowProfileEdit(false);
                    }}
                />
            )}

            {showPasswordChange && (
                <PasswordChangeModal
                    onClose={() => setShowPasswordChange(false)}
                    onSuccess={() => {
                        setShowPasswordChange(false);
                        alert('Password changed successfully!');
                    }}
                />
            )}
        </div>
    );
}

export default Dashboard;
