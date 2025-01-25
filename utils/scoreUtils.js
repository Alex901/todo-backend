const User = require('../models/User');
const Group = require('../models/Group');
const { randomlyAwardCurrency } = require('./currencyUtils');

async function calculateAndAwardScore(task) {
    let score = 0;
    let currencyChance = 0;

    // Simple scoring logic: 1 point per second spent
    if (task.isDone) {
        if (task.repeatable) {
            // Repeatable task scoring logic
            const baseScore = 1;
            //This is exponential, might have to rebalance this at some point. 
            const streakMultiplier = Math.pow(1.05, task.repeatStreak || 0);
            const repeatBonus = 0.1 * (task.repeatCount || 0);
            score = baseScore * streakMultiplier + repeatBonus;

            // Currency chance logic for repeatable tasks
            currencyChance = Math.min(0.01 * task.repeatStreak, 0.2);
            console.log("DEBUG: calculateAndAwardScore score repeatable: ", score);
        } else {
            // Non-repeatable task scoring logic
            score = 1;

            // Additional points for completing within the deadline
            if (task.dueDate) {
                score += 1;
                if (new Date(task.dueDate) >= new Date(task.completed)) {
                    console.log('Task completed within deadline');
                    score += 4;
                }
            }

                // Additional points for estimated time
                if (task.estimatedTime) {
                    score += 1; // Extra point for having an estimated time
                    const estimatedTimeInMs = task.estimatedTime * 60 * 60 * 1000; // Convert hours to milliseconds
                    if (task.totalTimeSpent <= estimatedTimeInMs) {
                        score += 3; // Additional points for completing within the estimated time
                    }
                }

            // Score increases with time spent on the task
            const hoursSpent = task.totalTimeSpent / (1000 * 60 * 60);
            score *= 1 + (0.05 * hoursSpent);
            console.log("DEBUG: calculateAndAwardScore: score1: ", score);

            // Additional points for each completed step
            const completedSteps = task.steps.filter(step => step.isDone).length;
            score += completedSteps;

            // Ensure the score does not exceed 10 points
            score = Math.min(score, 20);

            console.log("DEBUG: calculateAndAwardScore: score: ", score);

            // Currency chance logic for non-repeatable tasks
            currencyChance = score / 100;
        }
    }

    // Check if the task is owned by a user or a group
    const user = await User.findById(task.owner);
    if (user) {
        // Task is owned by a user
        user.settings.score += score;
        await user.save();

        // Award currency with a 10% chance for normal tasks and 5% for repeatable tasks
        await randomlyAwardCurrency(user._id, currencyChance);
    } else {
        // Task is owned by a group
        const group = await Group.findOne({ _id: task.owner });
        if (group) {
            currencyChance += 0.03; // Increase currency chance for group tasks
            const members = group.members.map(member => member.member_id);
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