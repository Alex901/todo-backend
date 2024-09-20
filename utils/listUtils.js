const Todo = require('../models/Todo');
const List = require('../models/List');
const User = require('../models/User');
const mongoose = require('mongoose');
const { isDoStatement } = require('typescript');

async function checkAndUpdateIsToday() {
    console.log('Running checkAndUpdateIsToday job');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of the day
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayOfMonth = today.getDate(); // 1 to 31
    const month = today.getMonth(); // 0 = January, 1 = February, ..., 11 = December

    const users = await User.find();
    console.log('\x1b[31m%s\x1b[0m', 'Users:', users.length);

    for (const user of users) {
        console.log('\x1b[31m%s\x1b[0m', 'Checking User:', user.username);
        const ownerId = user._id;
        const todayList = await List.findOne({ owner: ownerId, listName: 'today' });

        console.log('\x1b[31m%s\x1b[0m', 'Owner ID:', ownerId);
        console.log('\x1b[31m%s\x1b[0m', 'User Groups:', user.groups);

        const tasks = await Todo.find({
            $or: [
                { owner: ownerId },
                { owner: { $in: user.groups } }
            ]
        });

        console.log("\x1b[31mDEBUG: found tasks for user:", user.username, "tasks:", tasks.length, "\x1b[0m");
        // tasks.forEach((task, index) => {
        //     console.log(`\x1b[33mDEBUG: task ${index}:`, task.task, "\x1b[0m");
        // });

        let index = 0;
        for (const task of tasks) {
            console.log(`\x1b[35mDEBUG: task ${index}:`, task.task, "\x1b[0m");
            let isToday = false;

            if (!task.dueDate && !task.repeatable) {
                console.log('Task has no deadline and is not repeatable:', task.task);
                task.isToday = false;
                continue;
            }

            // Check deadline
            if (!task.estimatedTime) {
                // Case 1: No estimatedTime
                if (task.dueDate >= today && task.dueDate < tomorrow) {
                    console.log('Found a task with deadline today:', task.task);
                    isToday = true;
                }
            } else {
                // Case 2: With estimatedTime
                const estimatedTimeInMs = task.estimatedTime * 60 * 1000;
                const adjustedDeadline = new Date(task.dueDate.getTime() - estimatedTimeInMs);
                console.log("\x1b[38;5;214mAdjusted deadline:", adjustedDeadline, "\x1b[0m");

                if (adjustedDeadline >= today && adjustedDeadline < tomorrow) {
                    console.log('Found a task with adjusted deadline today:', task.task);
                    isToday = true;
                }
            }

            // Check repeatable parameters
            if (task.repeatable && (!task.repeatUntil || today <= task.repeatUntil)) {
                console.log('Checking repeatable task:', task.task);
                if (task.repeatInterval === 'daily') {
                    isToday = true;
                    resetDailyTask(task);
                    await task.save();
                    continue;
                } else if (task.repeatInterval === 'weekly') {
                    if (task.repeatDays.includes(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek])) {
                        isToday = true;
                        resetDailyTask(task);
                        await task.save();
                        continue;
                    }
                } else if (task.repeatInterval === 'monthly') {
                    isToday = (task.repeatMonthlyOption === 'start' && dayOfMonth === 1) ||
                        (task.repeatMonthlyOption === 'end' && dayOfMonth === new Date(today.getFullYear(), month + 1, 0).getDate());
                    if (isToday) {
                        resetDailyTask(task);
                        await task.save();
                        continue;
                    }
                } else if (task.repeatInterval === 'yearly') {
                    isToday = (task.repeatYearlyOption === 'start' && month === 0 && dayOfMonth === 1) ||
                        (task.repeatYearlyOption === 'end' && month === 11 && dayOfMonth === 31);
                    if (isToday) {
                        resetDailyTask(task);
                        await task.save();
                        continue;
                    }
                }
            }
            // await task.save();
            // task.isToday = isToday;
            // try {
            //     await task.save();
            // } catch (error) {
            //     console.log("\x1b[31mError saving task:", task.task, "\x1b[0m");
            //     console.log(error);
            // }
            index++;
        }
        console.log("Done porcessing tasks for user:", user.username, "tasks:", tasks.length, "\x1b[0m");
        populateTodayList(todayList, tasks);
    }
}

async function populateTodayList(todayList, tasks) {
    console.log('Populating today list');
    console.log('Today list:', todayList._id);
    console.log('Tasks:', tasks.length);
    for (const task of tasks) {
        //remove everything from today list
        task.inListNew = task.inListNew.filter(listId => listId.toString() !== todayList._id.toString());
        if (task.isToday === true) {
            console.log("\x1b[34mAdding task to today list:", task.task, "\x1b[0m");
            if (!task.inListNew.includes(todayList._id)) {
                task.inListNew.push(todayList._id);
                await task.save();
                continue;
            }
        }
    }
}

async function resetDailyTask(task) {
    console.log("DEBUG -- Resetting daily task:", task.task)
    if (task.repeatable) {
        console.log("DEBUG -- Task is repeatable -- proceeding:")
        if (task.started && !task.completed) { //Task was started but not completed
            console.log("DEBUG -- Task was started but not completed");
            task.created = new Date();
            task.isStarted = false;
            task.totalTimeSpent = 0;
            task.started = null;
            task.repeatStreak = 0;
        } else if (task.completed) { //task was completed
            console.log("DEBUG -- Task was completed");
            task.repeatableCompleted.push({
                startTime: task.started,
                completionTime: task.completed,
                duration: task.totalTimeSpent
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
            console.log("DEBUG -- Task was started but not completed");
            task.repeatStreak = 0;
            task.created = new Date();
        }
        task.isToday = true;
    }

}

module.exports = {
    checkAndUpdateIsToday
}