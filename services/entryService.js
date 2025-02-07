const Todo = require('../models/Todo');

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

module.exports = {
    linkTasks,
    unlinkTasks,
    updateTaskLinks
};