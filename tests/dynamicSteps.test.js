const mongoose = require('mongoose');
const { expect } = require('chai');
const mockdate = require('mockdate');
const app = require('../server'); // Use app for database connection
const User = require('../models/User');
const Group = require('../models/Group');
const Todo = require('../models/Todo');
const Notification = require('../models/Notification');
const List = require('../models/List');
const { updateDynamicSteps } = require('../services/entryService');

describe('Dynamic Steps Functionality', function () {
    this.timeout(30000);
    let userA, group;

    before(async function () {
        userA = new User({ username: 'userA', email: 'userA@test.com', password: 'password', settings: { currency: 100 } });
        await userA.save();

        group = new Group({ name: 'Test Group', owner: userA._id, members: [{ member_id: userA._id }] });
        await group.save();
    });

    after(async function () {
        await Promise.all([
            Todo.deleteMany(),
            User.deleteMany(),
            Group.deleteMany(),
            Notification.deleteMany(),
            List.deleteMany(),
        ]);
    });

    beforeEach(async function () {
        // Reset tasks before each test
        await Todo.deleteMany();
    });


    it('Should verify test setup is correct', async function () {
        // Check users
        const userACheck = await User.findOne({ username: 'userA' });
        expect(userACheck).to.not.be.null;

        // Check group
        const groupCheck = await Group.findOne({ name: 'Test Group' });
        expect(groupCheck).to.not.be.null;
        expect(groupCheck.members.length).to.equal(1);

        // Check tasks
        const tasks = await Todo.find();
        expect(tasks.length).to.equal(0); // Verify the number of tasks created

        // console.log('Test setup verified successfully!');
    });

    it('Should disable dynamic steps and create notification for insufficient funds (Normal User)', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'User Task (per day)',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate insufficient funds
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 0 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task was updated
        const updatedTask = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled

        // Verify the notification was created
        const notification = await Notification.findOne({ to: userA._id });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');

        // Reset mock date
        mockdate.reset();
    });

    it('Should deduct funds and update steps for sufficient funds (Normal User)', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'User Task (per day)',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Ensure sufficient funds
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user and task updates
        const updatedUser = await User.findOne({ username: 'userA' });
        const updatedTask = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
        // console.log('DEBUG: Updated User:', updatedUser);
        // console.log('DEBUG: Updated Task:', updatedTask);

        expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName

        // Reset mock date
        mockdate.reset();
    });

    it('Should disable dynamic steps and create notification for insufficient funds (Group)', async function () {
        // Create a task for the group
        const task = new Todo({
            task: 'Group Task (per day)',
            owner: group._id, // Group as the owner
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.2, // Price per step for group tasks
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate insufficient funds for the group owner
        await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 0 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task was updated
        const updatedTask = await Todo.findOne({ task: 'Group Task (per day)', owner: group._id });
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled

        // Verify the notification was created
        const notification = await Notification.findOne({ to: group.owner });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');

        // Reset mock date
        mockdate.reset();
    });

    it('Should deduct funds and update steps for sufficient funds (Group)', async function () {
        // Create a task for the group
        const task = new Todo({
            task: 'Group Task (per day)',
            owner: group._id, // Group as the owner
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.2, // Price per step for group tasks
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Ensure sufficient funds for the group owner
        await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 100 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user updates
        const updatedUser = await User.findOne({ _id: group.owner });
        expect(updatedUser.settings.currency).to.equal(99.8); // Deduct 0.2 currency for one step

        // Verify the task updates
        const updatedTask = await Todo.findOne({ task: 'Group Task (per day)', owner: group._id });
        expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName

        // Debug logs for verification
        // console.log('DEBUG: Updated User:', updatedUser);
        // console.log('DEBUG: Updated Task:', updatedTask);

        // Reset mock date
        mockdate.reset();
    });

    it('Should disable dynamic steps for multiple steps with insufficient funds (Normal User)', async function () {
        const task = new Todo({
            task: 'User Task (multiple steps)',
            owner: userA._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1,
            },
            steps: [
                { taskName: 'Do 10 pushups', reps: 10 },
                { taskName: 'Do 20 situps', reps: 20 },
            ],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 0 });

        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        mockdate.set(mockDate);

        await updateDynamicSteps();

        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false;

        const notification = await Notification.findOne({ to: userA._id });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');

        mockdate.reset();
    });

    it('Should keep steps unchanged when dynamic steps are inactivated (Normal User)', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'User Task (per day)',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Disable dynamic steps for the task
        await Todo.findByIdAndUpdate(task._id, { 'dynamicSteps.isEnabled': false });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task remains unchanged
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(10); // No change
        expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // No change

        // Reset mock date
        mockdate.reset();
    });

    it('Should keep steps unchanged when dynamic steps are inactivated (Group)', async function () {
        const task = new Todo({
            task: 'Group Task (per day)',
            owner: group._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.2,
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        await Todo.findByIdAndUpdate(task._id, { 'dynamicSteps.isEnabled': false });

        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        mockdate.set(mockDate);

        await updateDynamicSteps();

        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(20);
        expect(updatedTask.steps[0].taskName).to.equal('Do 20 situps');

        mockdate.reset();
    });

    //Currency tests

    it('Should disable dynamic steps and create notification for insufficient funds (Normal User)', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'User Task (per day)',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate insufficient funds
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 0 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task was updated
        const updatedTask = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled

        // Verify the notification was created
        const notification = await Notification.findOne({ to: userA._id });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');

        // Reset mock date
        mockdate.reset();
    });

    it('Should disable dynamic steps and create notification for insufficient funds (Group)', async function () {
        // Create a task for the group
        const task = new Todo({
            task: 'Group Task (per day)',
            owner: group._id, // Group as the owner
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.2, // Price per step for group tasks
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate insufficient funds for the group owner
        await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 0 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task was updated
        const updatedTask = await Todo.findOne({ task: 'Group Task (per day)', owner: group._id });
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled

        // Verify the notification was created
        const notification = await Notification.findOne({ to: group.owner });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');

        // Reset mock date
        mockdate.reset();
    });

    it('Should deduct funds and update steps for sufficient funds (Normal User)', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'User Task (per day)',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Ensure sufficient funds
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user and task updates
        const updatedUser = await User.findOne({ username: 'userA' });
        const updatedTask = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });

        expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName

        // Reset mock date
        mockdate.reset();
    });

    it('Should deduct funds and update steps for sufficient funds (Group)', async function () {
        // Create a task for the group
        const task = new Todo({
            task: 'Group Task (per day)',
            owner: group._id, // Group as the owner
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.2, // Price per step for group tasks
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Ensure sufficient funds for the group owner
        await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 100 });

        // Set mock date to simulate the passage of time
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user updates
        const updatedUser = await User.findOne({ _id: group.owner });
        expect(updatedUser.settings.currency).to.equal(99.8); // Deduct 0.2 currency for one step

        // Verify the task updates
        const updatedTask = await Todo.findOne({ task: 'Group Task (per day)', owner: group._id });
        expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName

        // Reset mock date
        mockdate.reset();
    });

    it('Should handle no tasks returned', async function () {
        // Ensure there are no tasks in the database
        await Todo.deleteMany();
        await Notification.deleteMany();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify that the tasks remain empty
        const tasks = await Todo.find();
        expect(tasks.length).to.equal(0); // Tasks should remain empty

        // Verify that no notifications were created
        const notifications = await Notification.find();
        expect(notifications.length).to.equal(0); // No notifications should be created

        // Verify that users and groups remain unchanged
        const users = await User.find();
        const groups = await Group.find();
        expect(users.length).to.be.greaterThan(0); // Users should remain unchanged
        expect(groups.length).to.be.greaterThan(0); // Groups should remain unchanged
    });

    it('Should handle task not repeatable', async function () {
        // Create a non-repeatable task
        const task = new Todo({
            task: 'Non-repeatable Task',
            owner: userA._id,
            repeatable: false, // Task is not repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1,
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify that the task remains unchanged
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.true; // Dynamic steps stay enabled
        expect(updatedTask.steps[0].reps).to.equal(10); // Reps remain unchanged
        expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // Task name remains unchanged

        // Verify that no notifications were created
        const notifications = await Notification.find({ to: userA._id });
        expect(notifications.length).to.equal(0); // No notifications should be created
    });

    it('Should handle "per repeat" interval — not today', async function () {
        // Create a task with "per repeat" interval
        const task = new Todo({
            task: 'Per Repeat Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per repeat',
                totalPrice: 0.1,
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            isToday: false, // Not today
            created: new Date(),
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify that the task remains unchanged
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.true; // Dynamic steps stay enabled
        expect(updatedTask.steps[0].reps).to.equal(10); // Reps remain unchanged
        expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // Task name remains unchanged

        // Verify that no notifications were created
        const notifications = await Notification.find({ to: userA._id });
        expect(notifications.length).to.equal(0); // No notifications should be created
    });

    it('Should handle "per repeat" interval — today, user owner, insufficient funds', async function () {
        // Create a task with "per repeat" interval
        const task = new Todo({
            task: 'Per Repeat Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per repeat',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: true, // Mark as started
            isDone: false,
            isToday: true, // Today
            created: new Date(),
        });
        await task.save();

        // Simulate insufficient funds
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 0 });

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled
        expect(updatedTask.steps[0].reps).to.equal(10); // Reps remain unchanged
        expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // Task name remains unchanged

        // Verify the notification was created
        const notification = await Notification.findOne({ to: userA._id });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');
    });

    it('Should handle "per repeat" interval — today, no owner field', async function () {
        // Create a task with "per repeat" interval and no owner field
        const task = new Todo({
            task: 'Per Repeat Task',
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per repeat',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: true, // Mark as started
            isDone: false,
            isToday: true, // Today
            created: new Date(),
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task remains unchanged
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.true; // Dynamic steps stay enabled
        expect(updatedTask.steps[0].reps).to.equal(10); // Reps remain unchanged
        expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // Task name remains unchanged
    });

    it('Should handle unknown incrementInterval value', async function () {
        // Attempt to create a task with an invalid incrementInterval value
        const task = new Todo({
            task: 'Unknown Interval Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per decade', // Invalid interval
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: true, // Mark as started
            isDone: false,
            created: new Date(),
        });

        let error = null;

        try {
            await task.save();
        } catch (err) {
            error = err;
        }

        // Verify that a ValidationError is thrown
        expect(error).to.not.be.null;
        expect(error.name).to.equal('ValidationError');
        expect(error.message).to.include('`per decade` is not a valid enum value for path `incrementInterval`');
    });

    it('Should handle "per day" interval — not yet elapsed', async function () {
        // Create a task with "per day" interval
        // console.log("DEBUG: owner before task creation:", userA);
        const task = new Todo({
            task: 'Per Day Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
            updatedAt: new Date(), // Set updatedAt to now
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task remains unchanged
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.true; // Dynamic steps stay enabled
        expect(updatedTask.steps[0].reps).to.equal(10); // Reps remain unchanged
        expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // Task name remains unchanged
        expect(updatedTask.updatedAt.getTime()).to.equal(task.updatedAt.getTime()); // updatedAt remains unchanged
    });

    it('Should handle "per day" interval — elapsed', async function () {
        // Create a task with "per day" interval
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 });
        // console.log("DEBUG: owner before task creation:", userA);
        const task = new Todo({
            task: 'Per Day Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per day',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
            updatedAt: new Date(), // Set updatedAt to now
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 25 * 60 * 60 * 1000); // Simulate 25 hours later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user and task updates
        const updatedUser = await User.findOne({ username: 'userA' });
        const updatedTask = await Todo.findById(task._id);

        expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
        expect(updatedTask.updatedAt.getTime()).to.be.greaterThan(task.updatedAt.getTime()); // updatedAt is updated

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle "per week" interval — elapsed', async function () {
        // Create a task with "per week" interval
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 });
        const task = new Todo({
            task: 'Per Week Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per week',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
            updatedAt: new Date(), // Set updatedAt to now
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // Simulate 8 days later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user and task updates
        const updatedUser = await User.findOne({ username: 'userA' });
        const updatedTask = await Todo.findById(task._id);

        expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
        expect(updatedTask.updatedAt.getTime()).to.be.greaterThan(task.updatedAt.getTime()); // updatedAt is updated

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle "per month" interval — elapsed', async function () {
        // Create a task with "per month" interval
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 });

        const task = new Todo({
            task: 'Per Month Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per month',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
            updatedAt: new Date(), // Set updatedAt to now
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); // Simulate 31 days later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user and task updates
        const updatedUser = await User.findOne({ username: 'userA' });
        const updatedTask = await Todo.findById(task._id);

        expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
        expect(updatedTask.updatedAt.getTime()).to.be.greaterThan(task.updatedAt.getTime()); // updatedAt is updated

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle "per year" interval — elapsed', async function () {
        // Create a task with "per year" interval
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 });

        const task = new Todo({
            task: 'Per Year Task',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per year',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
            updatedAt: new Date(), // Set updatedAt to now
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000); // Simulate 366 days later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user and task updates
        const updatedUser = await User.findOne({ username: 'userA' });
        const updatedTask = await Todo.findById(task._id);

        expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
        expect(updatedTask.updatedAt.getTime()).to.be.greaterThan(task.updatedAt.getTime()); // updatedAt is updated

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle owner as group (currency taken from group-owner)', async function () {
        // Create a task for the group
        const task = new Todo({
            task: 'Group Task',
            owner: group._id, // Group as the owner
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.2, // Price per step for group tasks
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Ensure sufficient funds for the group owner
        await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 100 });

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the user updates
        const updatedUser = await User.findOne({ _id: group.owner });
        expect(updatedUser.settings.currency).to.equal(99.8); // Deduct 0.2 currency for one step

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle step name replacing word-based number', async function () {
        // Create a task with a word-based number in taskName
        const task = new Todo({
            task: 'Word-Based Number Task',
            owner: userA._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0.1,
            },
            steps: [{ taskName: 'Do ten pushups', reps: 10 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle step name with no numeric or word value', async function () {
        // Create a task with no numeric or word-based value in taskName
        const task = new Todo({
            task: 'No Numeric Value Task',
            owner: userA._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                incrementInterval: 'per day',
                totalPrice: 0, // Price per step is 0
            },
            steps: [{ taskName: 'Stretch', reps: 0 }], // No numeric or word-based value in taskName
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task remains unchanged
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(0); // Reps remain unchanged
        expect(updatedTask.steps[0].taskName).to.equal('Stretch'); // Task name remains unchanged

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle rounding behavior for fractional reps', async function () {
        // Create a task with fractional reps
        const task = new Todo({
            task: 'Fractional Reps Task',
            owner: userA._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 25, // 25% increment
                incrementInterval: 'per day',
                totalPrice: 0.1,
            },
            steps: [{ taskName: 'Do 5 pushups', reps: 5 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(6.25); // Precise value stored
        expect(updatedTask.steps[0].taskName).to.equal('Do 6 pushups'); // Rounded-up value displayed

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle oldReps defaulting to zero', async function () {
        // Create a task with no reps property
        const task = new Todo({
            task: 'Default Reps Task',
            owner: userA._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per day',
                totalPrice: 0.1,
            },
            steps: [{ taskName: 'Do pushups' }], // No reps property
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(0); // Default to 0
        expect(updatedTask.steps[0].taskName).to.equal('Do pushups'); // Task name remains unchanged

        // Reset mockdate
        mockdate.reset();
    });

    it('Should handle multiple steps all updated', async function () {
        // Create a task with multiple steps
        const task = new Todo({
            task: 'Multiple Steps Task',
            owner: userA._id,
            repeatable: true,
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per day',
                totalPrice: 0.2,
            },
            steps: [
                { taskName: 'Do 10 pushups', reps: 10 },
                { taskName: 'Do 20 situps', reps: 20 },
            ],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Simulate the passage of time using mockdate
        const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simulate one day later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
        expect(updatedTask.steps[1].reps).to.equal(22); // 20 + 10% increment
        expect(updatedTask.steps[1].taskName).to.equal('Do 22 situps'); // Updated taskName

        // Reset mockdate
        mockdate.reset();
    });

    //Functional tests for multiple resets
    it('Should handle "per day" interval — multiple resets', async function () {
        // Test multiple resets for "per day" interval:
        // 1. First increment happens after 24 hours.
        // 2. No increment occurs before 24 hours.
        // 3. Second increment happens after another 24 hours.
    });

    it('Should handle "per week" interval — multiple resets', async function () {
        // Test multiple resets for "per week" interval:
        // 1. First increment happens after 7 days.
        // 2. No increment occurs before 7 days.
        // 3. Second increment happens after another 7 days.
    });

    it('Should handle "per month" interval — multiple resets', async function () {
        // Test multiple resets for "per month" interval:
        // 1. First increment happens after 30 days.
        // 2. No increment occurs before 30 days.
        // 3. Second increment happens after another 30 days.
    });

    it('Should handle "per year" interval — multiple resets', async function () {
        // Test multiple resets for "per year" interval:
        // 1. First increment happens after 365 days.
        // 2. No increment occurs before 365 days.
        // 3. Second increment happens after another 365 days.
    });

});