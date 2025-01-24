const User = require('../models/User');
const Notification = require('../models/Notification');

async function randomlyAwardCurrency(userId, chance) {
    const user = await User.findById(userId);
    if (user) {
        const random = Math.random();
        if (random < chance) {
            const currencyAwarded = 1;

            if (Math.random() < 0.001) {
                currencyAwarded = 100;
            }

            user.settings.currency += currencyAwarded;
            //notify user of currency award
            await user.save();

            const notification = new Notification({
                to: [userId],
                type: 'award',
                message: `Congratulations, you have been awarded ${currencyAwarded} coin(s) for completing a task!`
            });
            await notification.save();

            return currencyAwarded;
        }
    }
    return 0;
}

module.exports = {
    randomlyAwardCurrency
};