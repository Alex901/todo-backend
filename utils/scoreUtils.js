const User = require('../models/User');
const Group = require('../models/Group');
const { randomlyAwardCurrency } = require('./currencyUtils');

async function calculateAndAwardScore(task) {
    let score = 0;

    // Simple scoring logic: 1 point per second spent
    if (task.isDone) {
        score = 1;
    }

    // Check if the task is owned by a user or a group
    const user = await User.findById(task.owner);
    if (user) {
        // Task is owned by a user
        user.settings.score += score;
        await user.save();

        // Award currency with a 10% chance for normal tasks and 5% for repeatable tasks
        const currencyChance = task.repeatable ? 0.05 : 0.1;
        await randomlyAwardCurrency(user._id, currencyChance);
    } else {
        // Task is owned by a group
        const group = await Group.findOne({ _id: task.owner });
        if (group) {
            console.log("Group found, group members: ", group.members);
            const members = group.members.map(member => member.member_id);
            const currencyChance = task.repeatable ? 0.05 : 0.1;
            let currencyAwarded = false;

            for (const memberId of members) {
                const member = await User.findById(memberId);
                if (member) {
                    member.settings.score += score;
                    await member.save();

                    // Award currency to all members if one gets it
                    if (!currencyAwarded) {
                        currencyAwarded = await randomlyAwardCurrency(memberId, currencyChance) > 0;
                    } else {
                        await randomlyAwardCurrency(memberId, 1); // Ensure all members get the currency
                    }
                }
            }
        }
    }

    return score;
}

module.exports = {
    calculateAndAwardScore
};