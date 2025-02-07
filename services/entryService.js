const Todo = require('../models/Todo');

async function linkTasks(taskId, tasksBefore, tasksAfter) {
  // Link tasksBefore
  for (const beforeTaskId of tasksBefore) {
    const beforeTask = await Todo.findById(beforeTaskId);
    if (beforeTask && !beforeTask.tasksAfter.includes(taskId)) {
      beforeTask.tasksAfter.push(taskId);
      await beforeTask.save();
    }
  }

  // Link tasksAfter
  for (const afterTaskId of tasksAfter) {
    const afterTask = await Todo.findById(afterTaskId);
    if (afterTask && !afterTask.tasksBefore.includes(taskId)) {
      afterTask.tasksBefore.push(taskId);
      await afterTask.save();
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

  // Find new and removed tasksBefore
  const newTasksBefore = updatedTask.tasksBefore.filter(id => !existingTask.tasksBefore.includes(id));
  const removedTasksBefore = existingTask.tasksBefore.filter(id => !updatedTask.tasksBefore.includes(id));

  // Find new and removed tasksAfter
  const newTasksAfter = updatedTask.tasksAfter.filter(id => !existingTask.tasksAfter.includes(id));
  const removedTasksAfter = existingTask.tasksAfter.filter(id => !updatedTask.tasksAfter.includes(id));

  // Unlink removed tasks
  await unlinkTasksFromTask(taskId, removedTasksBefore, removedTasksAfter);

  // Link new tasks
  await linkTasks(taskId, newTasksBefore, newTasksAfter);
}

async function unlinkTasksFromTask(taskId, tasksBefore, tasksAfter) {
  // Unlink tasksBefore
  for (const beforeTaskId of tasksBefore) {
    const beforeTask = await Todo.findById(beforeTaskId);
    if (beforeTask) {
      beforeTask.tasksAfter = beforeTask.tasksAfter.filter(id => id.toString() !== taskId.toString());
      await beforeTask.save();
    }
  }

  // Unlink tasksAfter
  for (const afterTaskId of tasksAfter) {
    const afterTask = await Todo.findById(afterTaskId);
    if (afterTask) {
      afterTask.tasksBefore = afterTask.tasksBefore.filter(id => id.toString() !== taskId.toString());
      await afterTask.save();
    }
  }
}

module.exports = {
  linkTasks,
  unlinkTasks,
  updateTaskLinks
};