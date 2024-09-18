const Todo = require('../models/Todo');
const List = require('../models/List');
const User = require('../models/User');
const mongoose = require('mongoose');

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

    for (const user of users) {
        const userGroups = user.groups;
        const ownerId = user._id;
        const tasks = await Todo.find({
            $or: [
                { owner: ownerId },
                { owner: { $in: userGroups } }
            ]
        });

        console.log("\x1b[31mDEBUG: found tasks for user:", user.username, "tasks:", tasks.length, "\x1b[0m");

        const todayList = await List.findOne({ owner: ownerId, listName: 'today' });
        //Remember to remove owner etc

        for (const task of tasks) {
            console.log('Checking task:', task.task);
            task.isToday = false;
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
                } else if (task.repeatInterval === 'weekly') {
                    if (task.repeatDays.includes(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek])) {
                        isToday = true;
                    }
                } else if (task.repeatInterval === 'monthly') {
                    isToday = (task.repeatMonthlyOption === 'start' && dayOfMonth === 1) ||
                        (task.repeatMonthlyOption === 'end' && dayOfMonth === new Date(today.getFullYear(), month + 1, 0).getDate());
                } else if (task.repeatInterval === 'yearly') {
                    isToday = (task.repeatYearlyOption === 'start' && month === 0 && dayOfMonth === 1) ||
                        (task.repeatYearlyOption === 'end' && month === 11 && dayOfMonth === 31);
                }
            }

            task.isToday = isToday;
            await task.save();
        }
        populateTodayList(todayList, tasks);
    }
}

async function populateTodayList(todayList, tasks) {
    console.log('Populating today list');
    console.log('Today list:', todayList._id);
    for (const task of tasks) {
        //remove everything from today list
        task.inListNew = task.inListNew.filter(listId => listId.toString() !== todayList._id.toString());
        if (task.isToday === true) {
            if (!task.inListNew.includes(todayList._id)) {
                task.inListNew.push(todayList._id);
                await task.save();
            }
        }
    }
}

module.exports = {
    checkAndUpdateIsToday
}