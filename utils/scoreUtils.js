const User = require('../models/User');
const Group = require('../models/Group');
const List = require('../models/List');
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
            // console.log("DEBUG: calculateAndAwardScore score repeatable: ", score);
        } else {
            // Non-repeatable task scoring logic
            score = 1;

            if (task.totalTimeSpent < 5 * 60 * 1000) { //if time spent is less than 5 minutes
                score = 0;
            }

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
            // console.log("DEBUG: calculateAndAwardScore: score1: ", score);

            // Additional points for each completed step
            const completedSteps = task.steps.filter(step => step.isDone).length;
            score += completedSteps;

            // Ensure the score does not exceed 10 points
            score = Math.min(score, 20);

            // console.log("DEBUG: calculateAndAwardScore: score: ", score);

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

async function calculateTaskScore(task) {
    console.log(`\x1b[33mDEBUG: Calculating score for task: ${task.task}\x1b[0m`);

    const maxScore = 50; // Maximum score for a task
    let baseScore = 0;

    // If time spent is below 5 minutes, set score to 0
    if (task.totalTimeSpent < 5 * 60 * 1000) {
        task.score.score = 0;
        task.score.currency = 0;
        console.log(`\x1b[33mDEBUG: Total time spent is below 5 minutes. Score: ${task.score.score}, Currency: ${task.score.currency}\x1b[0m`);
        await task.save(); // Save the updated task
        return;
    }

    // Apply difficulty multiplier
    let difficultyMultiplier = 0.25;
    switch (task.difficulty) {
        case 'VERY EASY':
            difficultyMultiplier = 0.5;
            break;
        case 'EASY':
            difficultyMultiplier = 0.75;
            break;
        case 'NORMAL':
            difficultyMultiplier = 1;
            break;
        case 'HARD':
            difficultyMultiplier = 1.5;
            break;
        case 'VERY HARD':
            difficultyMultiplier = 2;
            break;
        default:
            difficultyMultiplier = .1;
            break;
    }

    // Apply priority multiplier
    let priorityMultiplier = 0.25;
    switch (task.priority) {
        case 'VERY LOW':
            priorityMultiplier = 0.5;
            break;
        case 'LOW':
            priorityMultiplier = 0.75;
            break;
        case 'NORMAL':
            priorityMultiplier = 1;
            break;
        case 'HIGH':
            priorityMultiplier = 1.5;
            break;
        case 'VERY HIGH':
            priorityMultiplier = 2;
            break;
    }

    // Apply time spent multiplier
    let timeMultiplier = 1 + (task.totalTimeSpent / (5 * 60 * 1000)) * 0.01;


    // Apply steps multiplier
    let stepsMultiplier = (task.steps?.length * .2 || .1);

    // Apply urgent task bonus
    let urgentBonus = task.isUrgent ? 5 : 0;

    baseScore += 1;

    console.log(`\x1b[33mDEBUG: Difficulty Multiplier: ${difficultyMultiplier}, Priority Multiplier: ${priorityMultiplier}, Time Multiplier: ${timeMultiplier}, Steps Multiplier: ${stepsMultiplier}, Urgent Bonus: ${urgentBonus}\x1b[0m`);
    // Calculate total score
    baseScore = maxScore * difficultyMultiplier * priorityMultiplier * timeMultiplier * stepsMultiplier + urgentBonus;

    // Ensure score does not exceed maxScore
    task.score.score = Math.min(baseScore, maxScore);

    // Calculate currency (rounded up)
    task.score.currency = Math.floor(task.score.score / 10);

    console.log(`\x1b[33mDEBUG: Updated task score: ${task.score.score}, currency: ${task.score.currency}\x1b[0m`);

    // Save the updated task
    await task.save();
}

async function recalculateListScores(listIds) {
    // console.log(`\x1b[33mDEBUG: Recalculating list scores for list IDs: ${listIds}\x1b[0m`);
    try {
        const Todo = require('../models/Todo'); // Lazy import to avoid circular dependency

        for (const listId of listIds) {
            const list = await List.findById(listId);
            if (!list) {
                console.error(`\x1b[31mERROR: List with ID ${listId} not found\x1b[0m`);
                continue; // Skip this list and move to the next one
            }

            // Find all entries (todos) related to the list
            const todos = await Todo.find({ inListNew: { $in: listId } });

            // Calculate the total score and currency based on the entries
            let totalScore = 0;
            let totalCurrency = 0;

            for (const todo of todos) {
                totalScore += todo.score.score; // Sum up the scores of all related entries
                totalCurrency += todo.score.currency; // Sum up the currency of all related entries
            }

            // Update the list's score and currency
            list.score = {
                score: totalScore,
                currency: totalCurrency
            };

            await list.save();
            // console.log(`\x1b[32mDEBUG: Updated list score for list ID ${listId}: ${list.score.score}, currency: ${list.score.currency}\x1b[0m`);
        }
    } catch (error) {
        console.error(`\x1b[31mERROR: Failed to recalculate list scores\x1b[0m`, error);
    }
}

async function addScore(user, amount) {
    if (!user || typeof amount !== 'number' || amount <= 0) {
        throw new Error('Invalid user or amount for adding score');
    }

    user.settings.score.score += amount; // Add the score to the user's total
    await user.save(); // Save the updated user to the database

    console.log(`\x1b[32mDEBUG: Added ${amount} score to user ${user._id}. Total score: ${user.settings.score.score}\x1b[0m`);
}

async function removeScore(user, amount) {
    if (!user || typeof amount !== 'number' || amount <= 0) {
        throw new Error('Invalid user or amount for removing score');
    }

    user.settings.score.score = Math.max(0, user.settings.score.score - amount); // Ensure score doesn't go below 0
    await user.save(); // Save the updated user to the database

    console.log(`\x1b[32mDEBUG: Removed ${amount} score from user ${user._id}. Total score: ${user.settings.score.score}\x1b[0m`);
}

async function addCurrency(user, amount) {
    if (!user || typeof amount !== 'number' || amount <= 0) {
        throw new Error('Invalid user or amount for adding currency');
    }

    user.settings.score.currency += amount; // Add the currency to the user's total
    await user.save(); // Save the updated user to the database

    console.log(`\x1b[32mDEBUG: Added ${amount} currency to user ${user._id}. Total currency: ${user.settings.score.currency}\x1b[0m`);
}

async function removeCurrency(user, amount) {
    if (!user || typeof amount !== 'number' || amount <= 0) {
        throw new Error('Invalid user or amount for removing currency');
    }

    user.settings.score.currency = Math.max(0, user.settings.score.currency - amount); // Ensure currency doesn't go below 0
    await user.save(); // Save the updated user to the database

    console.log(`\x1b[32mDEBUG: Removed ${amount} currency from user ${user._id}. Total currency: ${user.settings.score.currency}\x1b[0m`);
}


module.exports = {
    calculateAndAwardScore,
    calculateTaskScore,
    recalculateListScores,
    addScore,
    removeScore,
    addCurrency,
    removeCurrency
};