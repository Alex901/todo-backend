const mongoose = require('mongoose');

const emojiSchema = new mongoose.Schema({
    emoji: {
        type: String,
        required: true
    },
    count: {
        type: Number,
        required: true,
        default: 0
    }
});

const globalSettingsSchema = new mongoose.Schema({
    emojiSettings: {
        emojis: [emojiSchema]
    }
}, {
    collection: 'GlobalSettings',
    timestamps: true
});

async function initializeGlobalSettings() {
    const existingSettings = await GlobalSettings.findOne({});
    if (!existingSettings) {
        console.log('DEBUG -- No global settings found, creating default settings');
        const defaultSettings = new GlobalSettings({
            emojiSettings: {
                emojis: [
                    { emoji: '💼', count: 0 }, 
                    { emoji: '🏋️', count: 0 }, 
                    { emoji: '🍽️', count: 0 }, 
                    { emoji: '🧹', count: 0 }, 
                    { emoji: '🏠', count: 0 }, 
                    { emoji: '😊', count: 0 }, 
                    { emoji: '❌', count: 0 }, 
                    { emoji: '🚗', count: 0 }, 
                    { emoji: '💻', count: 0 }  
                ]
            }
        });
        await defaultSettings.save();
    }
}

const GlobalSettings = mongoose.model('GlobalSettings', globalSettingsSchema);

module.exports = {
    GlobalSettings,
    initializeGlobalSettings
};