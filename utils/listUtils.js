const Todo = require('../models/Todo');
const List = require('../models/List');
const User = require('../models/User');
const mongoose = require('mongoose');
const { isDoStatement } = require('typescript');

async function checkAndUpdateIsToday() {
    // console.log('Running checkAndUpdateIsToday job');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of the day
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayOfMonth = today.getDate(); // 1 to 31
    const month = today.getMonth(); // 0 = January, 1 = February, ..., 11 = December

    // console.log('Today:', dayOfWeek, ' -- ', today);
    // console.log('Tomorrow:', tomorrow); 

    const users = await User.find();
    // console.log('\x1b[31m%s\x1b[0m', 'Users:', users.length);

    for (const user of users) {
        // console.log('\x1b[31m%s\x1b[0m', 'Checking User:', user.username);
        const ownerId = user._id;
        const todayList = await List.findOne({ owner: ownerId, listName: 'today' });

        if (!users || !todayList) {
            // console.log('No users or today list found');
            return;
        }

        // console.log('\x1b[31m%s\x1b[0m', 'Owner ID:', ownerId);
        // console.log('\x1b[31m%s\x1b[0m', 'User Groups:', user.groups);

        const tasks = await Todo.find({
            $or: [
                { owner: ownerId },
                { owner: { $in: user.groups } }
            ]
        });

        if (!tasks || tasks.length === 0) {
            // console.log(`No tasks found for user: ${user.username}`);
            continue;
        }

        //    console.log("\x1b[31mDEBUG: found tasks for user:", user.username, "tasks:", tasks.length, "\x1b[0m");
        // tasks.forEach((task, index) => {
        //    console.log(`\x1b[33mDEBUG: task ${index}:`, task.task, "\x1b[0m");
        // });

        let index = 0;
        for (const task of tasks) {
            console.log(`\x1b[35mDEBUG: task ${index}:`, task.task, "\x1b[0m");
            let isToday = false;

            // Base case: Check if the task is repeatable
            if (task.repeatable) {
                // console.log('Checking repeatable task:', task.task);
                if (!task.repeatUntil || today <= task.repeatUntil) {
                    if (task.repeatInterval === 'daily') {
                        // console.log("\x1b[32mTask is daily\x1b[0m");
                        isToday = true;
                        resetDailyTask(task);


                    } else if (task.repeatInterval === 'weekly') {
                        //   console.log("\x1b[32mTask is Weekly\x1b[0m");
                        if (task.repeatDays.includes(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek])) {
                            //    console.log("\x1b[32m.. and should reset today today\x1b[0m");
                            isToday = true;
                            resetDailyTask(task);
                        }
                    } else if (task.repeatInterval === 'monthly') {
                        //  console.log("\x1b[32mTask is monthly\x1b[0m");
                        isToday = (task.repeatMonthlyOption === 'start' && dayOfMonth === 1) ||
                            (task.repeatMonthlyOption === 'end' && dayOfMonth === new Date(today.getFullYear(), month + 1, 0).getDate());
                        // console.log(`\x1b[33mTask: ${task.task}, isToday: ${isToday}\x1b[0m`);
                        if (isToday) {
                            resetDailyTask(task);
                        }
                    } else if (task.repeatInterval === 'yearly') {
                        //    console.log("\x1b[32mTask is yearly\x1b[0m");
                        isToday = (task.repeatYearlyOption === 'start' && month === 0 && dayOfMonth === 1) ||
                            (task.repeatYearlyOption === 'end' && month === 11 && dayOfMonth === 31);
                        if (isToday) {
                            resetDailyTask(task);
                        }
                    }
                } else {
                    // console.log('Task has expired, dont reset but remove from today:', task.task);
                    isToday = false;
                }
            } else {
                //To prevent users having tasks running over night, the user should be informad that the task ah been paused.
                if (task.isStarted && !task.isDone) {
                    task.isStarted = false;
                    await task.save();
                }
                // Non-repeatable tasks
                if (!task.dueDate) {
                    // console.log('Task has no deadline and is not repeatable:', task.task);
                    task.isToday = false;
                    index++;
                    await task.save();
                    continue;
                }

                if (task.isDone) {
                    task.isToday = false;
                    index++;
                    await task.save();
                    continue;
                }

                if (task.estimatedTime) {
                    // Task has a due date and an estimated time
                    const estimatedTimeInMs = task.estimatedTime * 60 * 1000;
                    const adjustedDeadline = new Date(task.dueDate.getTime() - estimatedTimeInMs);
                    // console.log("\x1b[31mAdjusted deadline:", adjustedDeadline, "\x1b[0m");
                    if (adjustedDeadline >= today && adjustedDeadline < tomorrow) {
                        //    console.log("\x1b[38;5;214mFound a task with adjusted deadline today:", task.task, "Adjusted deadline:", adjustedDeadline, "\x1b[0m");
                        isToday = true;
                        task.isStarted = false;
                    } else {
                        //  console.log("\x1b[33mFound a task with adjusted deadline but it does not fall within today:", task.task, "Adjusted deadline:", adjustedDeadline, "\x1b[0m");
                        isToday = false;
                    }
                } else {
                    // Task has a due date but no estimated time
                    if (task.dueDate >= today && task.dueDate < tomorrow) {
                        //  console.log('Found a task with deadline today:', task.task);
                        isToday = true;
                        task.isStarted = false;

                    } else {
                        isToday = false;
                    }
                }


            }
            console.log(`\x1b[31mTask: ${task.task}, isToday: ${isToday}\x1b[0m`);
            task.isToday = isToday;
            try {
                // console.log(`\x1b[33mDEBUG: Saving task: ${task.task}\x1b[0m`);
                await task.save();
                // console.log(`\x1b[32mDEBUG: Task saved successfully: ${task.task}\x1b[0m`);
            } catch (error) {
                console.error(`\x1b[31mERROR: Failed to save task: ${task.task}\x1b[0m`, error);
            }
            // console.log(`\x1b[32mTask: ${task.task}, isToday: ${task.isToday}\x1b[0m`);

            // const savedTask = await Todo.findById(task._id);
            // console.log(`\x1b[32mSaved Task: ${savedTask.task}, isToday: ${savedTask.isToday}\x1b[0m`);

            index++;
        }
        // console.log("Done porcessing tasks for user:", user.username, "tasks:", tasks.length, "\x1b[0m");
        await populateTodayList(todayList, tasks, user.username);
    }
    console.log('checkAndUpdateIsToday job completed');
}

async function populateTodayList(todayList, tasks, username) {


    // for (const task of tasks) {
    //     if (task.task === "Monthly Task End 3") {
    //         console.log(`Monthly Task End 3: ${task}`);
    //     }
    // }

    for (const task of tasks) {
        // Remove everything from today list
        // console.log(`\x1b[31mResetting task: ${task.task}\x1b[0m`);
        task.inListNew = task.inListNew.filter(listId => listId.toString() !== todayList._id.toString());

        if (task.isToday) {
            // console.log("\x1b[34mAdding task to today list:", task.task, "\x1b[0m");
            if (!task.inListNew.includes(todayList._id)) {
                // console.log(`\x1b[32mAdding task to today list \x1b[0m`);
                task.inListNew.push(todayList._id);
            }
        }
        // Save the task only if it was modified
        await task.save();
    }
}

async function resetDailyTask(task) {
    if (task.repeatable) {
        // console.log(`\x1b[33mDEBUG: Resetting repeatable task: ${task.task}\x1b[0m`);
        if (task.isStarted && !task.isDone) {
            // console.log(`\x1b[31mDEBUG: Task was started but not completed\x1b[0m`);
            // console.log(`\x1b[33mDEBUG: Task steps: ${JSON.stringify(task.steps, null, 2)}\x1b[0m`);
            task.repeatableCompleted.push({
                completed: false,
                startTime: task.started,
                duration: task.totalTimeSpent,
                completionTime: task.completed || new Date(), // Include completed date if available
                steps: task.steps?.map(step => ({
                    taskName: step.taskName,
                    isDone: step.isDone || false, // Ensure isDone is set to false
                    completed: step.isDone ? step.completed : new Date(), // Include completed date if available
                    completedBy: step.completedBy || null // Include completedBy if available
                })) || [] // Handle cases where steps are undefined
            });

            task.created = new Date();
            task.isStarted = false;
            task.totalTimeSpent = 0;
            task.started = null;
            task.repeatStreak = 0;

            console.log(`\x1b[32mDEBUG: Task reset successfully\x1b[0m`);

        } else if (task.isDone) { //task was completed
            //    console.log("DEBUG -- Task was completed -- reseting the task");
            task.repeatableCompleted.push({
                completed: true,
                startTime: task.started,
                completionTime: task.completed,
                duration: task.totalTimeSpent,
                completedBy: task.completedBy,
                steps: task.steps?.map(step => ({
                    taskName: step.taskName,
                    completed: step.completed,
                    completedBy: step.completedBy
                })) || []
            });
            if (task.repeatStreak === undefined) {
                task.repeatStreak = 1;
            } else {
                task.repeatStreak++;
            }
            task.created = new Date();
            task.isStarted = false;
            task.isDone = false;
            task.totalTimeSpent = 0;
            task.completed = null;
            task.started = null;
        } else { //Task was not started
            // console.log("DEBUG -- Task was not started and thus not completed -- reset repeatStreak");
            task.repeatStreak = 0;
            task.created = new Date();
        }
        //just a precaution
        if (task.steps && task.steps.length > 0) {
            task.steps.forEach(step => {
                step.isDone = false;
                step.completed = null;
                step.completedBy = null;
            });
        }
    }
    // console.log(`\x1b[32mDEBUG: Task ${task.task} reset successfully\x1b[0m`);

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
    let difficultyMultiplier = 1;
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
    }

    // Apply priority multiplier
    let priorityMultiplier = 1;
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
    let timeMultiplier = Math.min(task.totalTimeSpent / 60, 1);

    // Apply steps multiplier
    let stepsMultiplier = Math.min((task.steps?.length || 0) / 10, 1);

    // Apply urgent task bonus
    let urgentBonus = task.isUrgent ? 5 : 0;

    // Calculate total score
    baseScore = maxScore * difficultyMultiplier * priorityMultiplier * timeMultiplier * stepsMultiplier + urgentBonus;

    // Ensure score does not exceed maxScore
    task.score.score = Math.min(baseScore, maxScore);

    // Calculate currency (rounded up)
    task.score.currency = Math.ceil(task.score.score / 10);

    console.log(`\x1b[33mDEBUG: Updated task score: ${task.score.score}, currency: ${task.score.currency}\x1b[0m`);

    // Save the updated task
    await task.save();
}

async function recalculateListScores(listIds) {
    console.log(`\x1b[33mDEBUG: Recalculating list scores for list IDs: ${listIds}\x1b[0m`);
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
            console.log(`\x1b[32mDEBUG: Updated list score for list ID ${listId}: ${list.score.score}, currency: ${list.score.currency}\x1b[0m`);
        }
    } catch (error) {
        console.error(`\x1b[31mERROR: Failed to recalculate list scores\x1b[0m`, error);
    }
}

module.exports = {
    checkAndUpdateIsToday,
    calculateTaskScore,
    recalculateListScores
}