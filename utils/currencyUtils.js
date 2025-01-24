const User = require('../models/User');

async function randomlyAwardCurrency(userId, chance) {
    const user = await User.findById(userId);
    if (user) {
        const random = Math.random();
        if (random < chance) {
            const currencyAwarded = 1;
            user.currency += currencyAwarded;
            await user.save();
            return currencyAwarded;
        }
    }
    return 0;
}

module.exports = {
    randomlyAwardCurrency
};