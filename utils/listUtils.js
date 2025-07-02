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
            // console.log(`\x1b[35mDEBUG: task ${index}:`, task.task, "\x1b[0m");
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
            // console.log(`\x1b[31mTask: ${task.task}, isToday: ${isToday}\x1b[0m`);
            task.isToday = isToday;
            await task.save();
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
    if (task.repeatable) { //just a precaution
        if (task.steps && task.steps.length > 0) {
            task.steps.forEach(step => {
                step.isDone = false;
                step.completed = null;
            });
        }
        if (task.isStarted && !task.isDone) { //Task was started but not completed
            // console.log("DEBUG -- Task was started but not completed");
              // Task was started but not completed
            task.repeatableCompleted.push({
                startTime: task.started,
                duration: task.totalTimeSpent,
                steps: task.steps?.map(step => ({
                    taskName: step.taskName,
                    isDone: step.isDone,
                    completed: step.completed || null // Include completed date if available
                })) || [] // Handle cases where steps are undefined
            });

            task.created = new Date();
            task.isStarted = false;
            task.totalTimeSpent = 0;
            task.started = null;
            task.repeatStreak = 0;
        } else if (task.isDone) { //task was completed
            //    console.log("DEBUG -- Task was completed -- reseting the task");
            task.repeatableCompleted.push({
                startTime: task.started,
                completionTime: task.completed,
                duration: task.totalTimeSpent,
                steps: task.steps?.map(step => ({
                    taskName: step.taskName,
                    completed: step.completed
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
    }

}

module.exports = {
    checkAndUpdateIsToday
}