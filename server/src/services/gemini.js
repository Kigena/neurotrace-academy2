import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class GeminiService {
    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    /**
     * Build context-aware system prompt
     */
    buildSystemPrompt(userContext, eegPatterns) {
        return `You are an EEG teaching assistant for NeuroTrace Academy, an interactive platform for learning EEG interpretation.

User Context:
- Name: ${userContext.name || 'Student'}
- Quizzes taken: ${userContext.quizzesTaken || 0}
- Overall accuracy: ${userContext.accuracy || 0}%
- Best score: ${userContext.bestScore || 0}%

Your role:
1. Help students learn EEG interpretation and pattern recognition
2. Explain EEG patterns, syndromes, and clinical significance
3. Provide educational guidance, not just answers
4. Reference specific patterns and encourage critical thinking
5. Be supportive, clear, and use appropriate medical terminology

Available EEG Patterns in the database:
${eegPatterns || 'Loading pattern database...'}

Guidelines:
- When asked about patterns, reference their clinical significance
- For quiz help, explain the reasoning, don't just give answers
- Encourage learning through understanding, not memorization
- Be concise but thorough
- Use medical terminology appropriately for the student level`;
    }

    /**
     * Build pattern context from EEG patterns
     */
    buildPatternsContext() {
        // This will be populated with actual patterns from patterns.js
        // For now, including common patterns
        return `Common EEG Patterns:
- Spike-and-Wave: Brief sharp spike followed by slow wave, characteristic of absence seizures
- BECTS (Benign Epilepsy with Centrotemporal Spikes): High-amplitude centrotemporal spikes during sleep
- Hypsarrhythmia: Chaotic high-voltage slow waves with multifocal spikes (infantile spasms)
- 3 Hz Spike-Wave: Regular 3 Hz generalized spike-wave discharges (absence epilepsy)
- Photoparoxysmal Response: Epileptiform response to photic stimulation
- Alpha Rhythm: 8-12 Hz posterior dominant rhythm in awake, relaxed state
- Sleep Spindles: 12-14 Hz waveforms during stage 2 sleep
- K-Complexes: Sharp negative wave followed by positive component in sleep`;
    }

    /**
     * Generate AI response with context
     */
    async generateResponse(userMessage, userContext = {}, chatHistory = []) {
        try {
            const systemPrompt = this.buildSystemPrompt(
                userContext,
                this.buildPatternsContext()
            );

            // Build conversation history
            const conversationHistory = chatHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            // Start chat session with history
            const chat = this.model.startChat({
                history: conversationHistory,
                generationConfig: {
                    maxOutputTokens: 2000,
                    temperature: 0.7,
                },
            });

            // Add system context as first message if no history
            const contextualMessage = chatHistory.length === 0
                ? `${systemPrompt}\n\nUser question: ${userMessage}`
                : userMessage;

            const result = await chat.sendMessage(contextualMessage);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini API error:', error);
            throw new Error('Failed to generate AI response. Please try again.');
        }
    }

    /**
     * Generate quick suggestions for new users
     */
    getSuggestedQuestions() {
        return [
            "What are spike-and-wave patterns?",
            "Explain the difference between BECTS and absence seizures",
            "How do I identify hypsarrhythmia?",
            "What should I study first?",
            "Create a study plan for me"
        ];
    }
}

export default new GeminiService();
