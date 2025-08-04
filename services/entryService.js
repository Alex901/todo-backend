const Todo = require('../models/Todo');
const User = require('../models/User');
const Group = require('../models/Group');
const Notification = require('../models/Notification'); // Assuming you have a notification model
const numberWordsToNumbers = require('../utils/numberMapping');

async function linkTasks(taskId, tasksBefore, tasksAfter) {
    console.log('Linking Tasks Before:', tasksBefore);
    console.log('Linking Tasks After:', tasksAfter);

    // Link tasksBefore
    for (const beforeTaskId of tasksBefore) {
        const beforeTask = await Todo.findById(beforeTaskId);
        if (beforeTask && !beforeTask.tasksAfter.includes(taskId)) {
            beforeTask.tasksAfter.push(taskId);
            await beforeTask.save();
            console.log(`Linked ${taskId} to tasksAfter of ${beforeTaskId}`);
        }
    }

    // Link tasksAfter
    for (const afterTaskId of tasksAfter) {
        const afterTask = await Todo.findById(afterTaskId);
        if (afterTask && !afterTask.tasksBefore.includes(taskId)) {
            afterTask.tasksBefore.push(taskId);
            await afterTask.save();
            console.log(`Linked ${taskId} to tasksBefore of ${afterTaskId}`);
        }
    }
}

async function unlinkTasks(taskId) {
    // Find the task to clear the links for
    const task = await Todo.findById(taskId);
    if (!task) {
        throw new Error('Task not found');
    }

    // Unlink tasksBefore
    const tasksBefore = await Todo.find({ tasksAfter: taskId });
    for (const beforeTask of tasksBefore) {
        beforeTask.tasksAfter = beforeTask.tasksAfter.filter(id => id.toString() !== taskId.toString());
        await beforeTask.save();
    }

    // Unlink tasksAfter
    const tasksAfter = await Todo.find({ tasksBefore: taskId });
    for (const afterTask of tasksAfter) {
        afterTask.tasksBefore = afterTask.tasksBefore.filter(id => id.toString() !== taskId.toString());
        await afterTask.save();
    }

    // Clear the links in the task itself
    task.tasksBefore = [];
    task.tasksAfter = [];
    await task.save();
}

async function updateTaskLinks(taskId, updatedTask) {
    const existingTask = await Todo.findById(taskId);

    if (!existingTask) {
        throw new Error('Task not found');
    }
    console.log("Updated task in updateTaskLinks", updatedTask)
    console.log("Existing task in updateTaskLinks", existingTask)

    console.log('Existing Task tasksBefore:', existingTask.tasksBefore);
    console.log('Existing Task tasksAfter:', existingTask.tasksAfter);
    console.log("-----------------------------------")
    console.log('Updated Task tasksBefore:', updatedTask.tasksBefore);
    console.log('Updated Task tasksAfter:', updatedTask.tasksAfter);

    // Find new and removed tasksBefore
    const newTasksBefore = updatedTask.tasksBefore.filter(id => !existingTask.tasksBefore.includes(id));
    const removedTasksBefore = existingTask.tasksBefore.filter(id => !updatedTask.tasksBefore.includes(id));

    console.log('New Tasks Before:', newTasksBefore);
    console.log('Removed Tasks Before:', removedTasksBefore);

    // Find new and removed tasksAfter
    const newTasksAfter = updatedTask.tasksAfter.filter(id => !existingTask.tasksAfter.includes(id));
    const removedTasksAfter = existingTask.tasksAfter.filter(id => !updatedTask.tasksAfter.includes(id));

    console.log('New Tasks After:', newTasksAfter);
    console.log('Removed Tasks After:', removedTasksAfter);

    // Unlink removed tasks
    await unlinkTasksFromTask(taskId, removedTasksBefore, removedTasksAfter);

    // Link new tasks
    await linkTasks(taskId, newTasksBefore, newTasksAfter);
}

async function unlinkTasksFromTask(taskId, tasksBefore, tasksAfter) {
    console.log('Unlinking Tasks Before:', tasksBefore);
    console.log('Unlinking Tasks After:', tasksAfter);

    // Unlink tasksBefore
    for (const beforeTaskId of tasksBefore) {
        const beforeTask = await Todo.findById(beforeTaskId);
        if (beforeTask) {
            beforeTask.tasksAfter = beforeTask.tasksAfter.filter(id => id.toString() !== taskId.toString());
            await beforeTask.save();
            console.log(`Unlinked ${taskId} from tasksAfter of ${beforeTaskId}`);
        }
    }

    // Unlink tasksAfter
    for (const afterTaskId of tasksAfter) {
        const afterTask = await Todo.findById(afterTaskId);
        if (afterTask) {
            afterTask.tasksBefore = afterTask.tasksBefore.filter(id => id.toString() !== taskId.toString());
            await afterTask.save();
            console.log(`Unlinked ${taskId} from tasksBefore of ${afterTaskId}`);
        }
    }
}

async function checkMissedDeadlines() {
    try {
        // Find all tasks that are not completed and have a dueDate
        const todos = await Todo.find({ isDone: false, dueDate: { $ne: null } });
        console.log("Found todos for missed deadlines:", todos.length);

        for (const todo of todos) {
            // Ensure the task has a valid dueDate
            if (!todo.dueDate) {
                console.log(`Skipping task "${todo.task}" as it has no dueDate.`);
                continue;
            }

            // Check if the dueDate has passed
            if (todo.dueDate < new Date()) {
                // Check if this dueDate is already recorded in `pastDueDate`
                const alreadyRecorded = todo.pastDueDate.some(
                    (entry) => entry.missedDueDate.getTime() === todo.dueDate.getTime()
                );

                if (!alreadyRecorded) {
                    // Add a new entry to `pastDueDate`
                    todo.pastDueDate.push({
                        missedDueDate: todo.dueDate,
                        wasStarted: todo.isStarted || false, // Default to false if undefined
                        totalTimeSpent: todo.totalTimeSpent || 0, // Default to 0 if undefined
                        message: `Missed deadline on ${todo.dueDate.toISOString()}`
                    });

                    console.log(`Added missed deadline for task: "${todo.task}"`);
                }
            }
        }

        // Save all updated tasks
        await Promise.all(todos.map((todo) => todo.save()));
        console.log('Finished checking for missed deadlines.');
    } catch (error) {
        console.error('Error checking for missed deadlines:', error);
    }
}

/**
 * Maps priority and difficulty to numerical values for comparison.
 */
const priorityMap = {
    'VERY HIGH': 5,
    'HIGH': 4,
    'NORMAL': 3,
    'LOW': 2,
    'VERY LOW': 1,
    '': 0
};

const difficultyMap = {
    'VERY HARD': 5,
    'HARD': 4,
    'NORMAL': 3,
    'EASY': 2,
    'VERY EASY': 1,
    '': 0
};

/**
 * Step 1: Sort tasks based on the specified attribute.
 * @param {Array} tasks - Array of tasks to sort.
 * @param {string} attribute - Attribute to sort by (priority, difficulty, estimatedTime, etc.).
 * @param {string} order - Order of sorting ('ascending' or 'descending'). 
* @returns {Array} - Sorted tasks.
 */
const sortTasks = (tasks, attribute, order) => {
    const sortedTasks = tasks.sort((a, b) => {
        if (attribute === 'priority') {
            return priorityMap[b.priority] - priorityMap[a.priority];
        } else if (attribute === 'difficulty') {
            return difficultyMap[b.difficulty] - difficultyMap[a.difficulty];
        } else if (attribute === 'estimatedTime') {
            return (a.estimatedTime || 0) - (b.estimatedTime || 0); // Ascending order for time
        } else if (attribute === 'urgent') {
            return b.isUrgent - a.isUrgent; // Urgent tasks first
        } else if (attribute === 'random') {
            return Math.random() - 0.5; // Random order
        } else {
            throw new Error('Invalid attribute for sorting');
        }
    });

    // Reverse the order if "ascending" is specified
    if (order === 'ascending') {
        if (attribute === 'urgent') {
            return sortedTasks;
        }
        return sortedTasks.reverse();
    }

    return sortedTasks; // Default is descending
};

/**
 * Step 2: Schedule tasks day by day.
 * @param {Array} tasks - Sorted tasks to schedule.
 * @param {number} maxTasks - Maximum number of tasks per day.
 * @returns {Array} - Scheduled tasks with their assigned days.
 */
const scheduleTasks = async (tasks, maxTasks) => {
    const scheduledTasks = [];
    let currentDate = new Date(); // Start from today

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0); // Start of today

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999); // End of today

    for (const task of tasks) {
        let taskScheduled = false;

        // Try to schedule the task day by day
        while (!taskScheduled) {
            // Define the scheduling window for the current day
            const dayStart = new Date(currentDate);
            dayStart.setHours(9, 0, 0, 0); // Start at 9 AM

            const dayEnd = new Date(currentDate);
            dayEnd.setHours(20, 0, 0, 0); // End at 8 PM

            // Fetch existing tasks for the current day
            const existingTasks = await Todo.find({
                dueDate: { $gte: dayStart, $lte: dayEnd },
                repeatable: { $ne: true }
            }).sort({ dueDate: 1 }); // Sort by dueDate to process in order

            // Calculate the earliest available time slot
            let availableStartTime = new Date(dayStart);

            for (const existingTask of existingTasks) {
                const existingTaskEndTime = new Date(existingTask.dueDate);
                existingTaskEndTime.setMinutes(existingTaskEndTime.getMinutes() + (existingTask.estimatedTime || 0));

                // If there's a gap before the existing task, schedule the new task there
                if (availableStartTime < existingTask.dueDate &&
                    new Date(availableStartTime.getTime() + (task.estimatedTime || 0) * 60000) <= existingTask.dueDate) {
                    break;
                }

                // Update the available start time to after the existing task
                availableStartTime = new Date(existingTaskEndTime);
            }

            // Ensure the task fits within the scheduling window
            const taskEndTime = new Date(availableStartTime.getTime() + (task.estimatedTime || 0) * 60000);
            if (taskEndTime <= dayEnd) {
                task.dueDate = availableStartTime; // Assign the task to the available start time
                if (task.dueDate >= todayStart && task.dueDate <= todayEnd) {
                    task.isToday = true; // Mark the task as "today"
                } else {
                    task.isToday = false; // Ensure it's false for other days
                }
                await task.save(); // Save the updated task
                scheduledTasks.push(task);
                taskScheduled = true;
            } else {
                // Move to the next day if the task doesn't fit
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    }

    return scheduledTasks;
};

async function updateDynamicSteps() {
    const tasks = await Todo.find({ 'dynamicSteps.isEnabled': true });
    console.log(`Found ${tasks.length} tasks with dynamic steps enabled.`);

    for (const task of tasks) {
        const { dynamicSteps, owner, createdAt, updatedAt, repeatInterval, isToday } = task;
        const { increment, incrementInterval, totalPrice } = dynamicSteps;

        const now = new Date();
        let shouldIncrement = false;

        // Determine if the step should be incremented based on incrementInterval
        if (incrementInterval === 'per repeat') {
            if (isToday) {
                shouldIncrement = true;
            }
        } else {
            const intervalMapping = {
                'per day': 24 * 60 * 60 * 1000, // 1 day in ms
                'per week': 7 * 24 * 60 * 60 * 1000, // 1 week in ms
                'per month': 30 * 24 * 60 * 60 * 1000, // Approx. 1 month in ms
                'per year': 365 * 24 * 60 * 60 * 1000 // Approx. 1 year in ms
            };

            const intervalMs = intervalMapping[incrementInterval];
            if (intervalMs && now - updatedAt >= intervalMs) {
                shouldIncrement = true;
            }
        }

        if (!shouldIncrement) {
            continue; // Skip if the interval hasn't passed
        }

        // Check if the owner has enough currency
        let ownerEntity = null;

        if (owner) {
            const user = await User.findById(owner);
            const group = await Group.findById(owner);

            if (group) {
                // If the owner is a group, find the group's owner
                ownerEntity = await User.findById(group.owner);
            } else if (user) {
                ownerEntity = user;
            }
        }

        const ownerCurrency = ownerEntity?.settings.currency || 0;

        if (ownerCurrency < totalPrice) {
            // Disable dynamic steps and notify the owner
            task.dynamicSteps.isEnabled = false;
            await task.save();

            const notification = new Notification({
                to: owner,
                message: `Dynamic steps were disabled for task "${task.task}" due to insufficient currency.`,
                type: 'info',
                createdAt: new Date()
            });
            await notification.save();
            continue; // Skip further processing for this task
        } else {
            ownerEntity.settings.currency -= totalPrice; // Deduct the currency
            await ownerEntity.save();
        }

        // Increment steps
        for (const step of task.steps) {
            const oldReps = step.reps || 0;
            const newReps = Math.ceil(oldReps * (1 + increment / 100)); // Round to the nearest whole number

            if (newReps !== oldReps) {
                step.reps = newReps;

                // Update taskName to reflect new reps
                const taskName = step.taskName || '';

                // Check for numerical representation
                let updatedTaskName = taskName.replace(/\d+/, newReps);

                // Check for alphabetical representation if no numerical match is found
                if (updatedTaskName === taskName) {
                    for (const language of Object.keys(numberWordsToNumbers)) {
                        for (const [word, number] of Object.entries(numberWordsToNumbers[language])) {
                            const regex = new RegExp(`\\b${word}\\b`, 'i'); // Match whole word, case-insensitive
                            if (regex.test(taskName) && number === oldReps) {
                                updatedTaskName = taskName.replace(regex, newReps.toString());
                                break;
                            }
                        }
                        if (updatedTaskName !== taskName) {
                            break; // Exit language loop if a match is found
                        }
                    }
                }

                step.taskName = updatedTaskName;
            }
        }

        // Save the updated task
        task.updatedAt = now;
        await task.save();
    }
}

module.exports = {
    linkTasks,
    unlinkTasks,
    updateTaskLinks,
    checkMissedDeadlines,
    sortTasks,
    scheduleTasks,
    updateDynamicSteps
};