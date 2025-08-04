const mongoose = require('mongoose');
const { expect } = require('chai');
const mockdate = require('mockdate');
const app = require('../server'); // Use app for database connection
const User = require('../models/User');
const Group = require('../models/Group');
const Todo = require('../models/Todo');
const Notification = require('../models/Notification');
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

        console.log('Test setup verified successfully!');
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

    it('Should recognize and update reps for "Do five pushups"', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'Do five pushups',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10,
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do five pushups', reps: 5 }],
            isStarted: false,
            isDone: false,
            isToday: true,
            created: new Date(),
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);
        console.log('DEBUG: Updated Task:', updatedTask);
        expect(updatedTask.steps[0].reps).to.equal(6); // 5 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 6 pushups'); // Updated taskName

        // Debug logs for verification
        console.log('DEBUG: Updated Task:', updatedTask);
    });

    it('Should recognize and update reps for "Find 9 fish"', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'Find 9 fish',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 1, // 1% increment
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Find 9 fish', reps: 9 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
            isToday: true
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);

        // Assert precise reps value
        expect(updatedTask.steps[0].reps).to.equal(9.09); // 9 + 1% increment (stored as precise value)

        // Assert displayed reps value (rounded up)
        expect(updatedTask.steps[0].taskName).to.equal('Find 9 fish'); // Updated taskName reflects rounded-up value
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

    it('Should update steps for "per repeat" interval (Normal User)', async function () {
        // Create a task for userA
        const task = new Todo({
            task: 'User Task (per repeat)',
            owner: userA._id,
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per repeat',
                totalPrice: 0.1, // Price per step
            },
            steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
            isStarted: true, // Mark as started for "per repeat" interval
            isDone: false,
            created: new Date(),
            isToday: true
        });
        await task.save();

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);

        // Assert precise reps value
        expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment (stored as precise value)

        // Assert displayed reps value (rounded up)
        expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName reflects rounded-up value
    });

    it('Should update steps for "per year" interval (Group)', async function () {
        // Create a task for the group
        const task = new Todo({
            task: 'Group Task (per year)',
            owner: group._id, // Group as the owner
            repeatable: true, // Ensure the task is repeatable
            dynamicSteps: {
                isEnabled: true,
                increment: 10, // 10% increment
                incrementInterval: 'per year',
                totalPrice: 0.2, // Price per step for group tasks
            },
            steps: [{ taskName: 'Do 20 situps', reps: 20 }],
            isStarted: false,
            isDone: false,
            created: new Date(),
        });
        await task.save();

        // Set mock date to simulate the passage of one year
        const mockDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Simulate one year later
        mockdate.set(mockDate);

        // Trigger the algorithm
        await updateDynamicSteps();

        // Verify the task updates
        const updatedTask = await Todo.findById(task._id);

        // Assert precise reps value
        expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment (stored as precise value)

        // Assert displayed reps value (rounded up)
        expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName reflects rounded-up value

        // Debug logs for verification
        console.log('DEBUG: Updated Task:', updatedTask);

        // Reset mock date
        mockdate.reset();
    });

    it('Should recognize and update reps for "Do five pushups"', async function () {
        const task = new Todo({
            task: 'Do five pushups',
            owner: userA._id,
            dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
            steps: [{ taskName: 'Do five pushups', reps: 5 }],
            isStarted: false,
            isDone: false,
            created: new Date()
        });
        await task.save();

        await updateDynamicSteps();

        const updatedTask = await Todo.findById(task._id);
        expect(updatedTask.steps[0].reps).to.equal(6); // 5 + 10% increment
        expect(updatedTask.steps[0].taskName).to.equal('Do 6 pushups'); // Updated taskName
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

    //Number recognition tests

    it('Should recognize and update reps for "Do five pushups" (Normal User)', async function () {
        // Test that the number "five" is recognized and reps are updated correctly for a normal user task.
    });

    it('Should recognize and update reps for "Find 9 fish" (Normal User)', async function () {
        // Test that the number "9" is recognized and reps are updated correctly for a normal user task.
    });

    it('Should recognize and update reps for "Do five pushups" (Group)', async function () {
        // Test that the number "five" is recognized and reps are updated correctly for a group task.
    });

    it('Should recognize and update reps for "Find 9 fish" (Group)', async function () {
        // Test that the number "9" is recognized and reps are updated correctly for a group task.
    });


    //Multiple steps

    it('Should disable dynamic steps for multiple steps with insufficient funds (Normal User)', async function () {
        // Test that dynamic steps are disabled for a task with multiple steps when the user has insufficient funds.
    });

    it('Should disable dynamic steps for multiple steps with insufficient funds (Group)', async function () {
        // Test that dynamic steps are disabled for a group task with multiple steps when the group owner has insufficient funds.
    });

    it('Should deduct funds and update steps for multiple steps with sufficient funds (Normal User)', async function () {
        // Test that funds are deducted and steps are updated correctly for a task with multiple steps when the user has sufficient funds.
    });

    it('Should deduct funds and update steps for multiple steps with sufficient funds (Group)', async function () {
        // Test that funds are deducted and steps are updated correctly for a group task with multiple steps when the group owner has sufficient funds.
    });

    //Dynamic steps inactivation

    it('Should keep steps unchanged when dynamic steps are inactivated (Normal User)', async function () {
        // Test that steps remain unchanged when dynamic steps are inactivated for a normal user task.
    });

    it('Should keep steps unchanged when dynamic steps are inactivated (Group)', async function () {
        // Test that steps remain unchanged when dynamic steps are inactivated for a group task.
    });

    it('Should remove steps when dynamic steps are inactivated (Normal User)', async function () {
        // Test that steps are removed when dynamic steps are inactivated for a normal user task.
    });

    it('Should remove steps when dynamic steps are inactivated (Group)', async function () {
        // Test that steps are removed when dynamic steps are inactivated for a group task.
    });

    //Increment intervals tests

    it('Should update steps for "per repeat" interval (Normal User)', async function () {
        // Test that steps are updated correctly for the "per repeat" interval for a normal user task.
    });

    it('Should update steps for "per repeat" interval (Group)', async function () {
        // Test that steps are updated correctly for the "per repeat" interval for a group task.
    });

    it('Should update steps for "per day" interval (Normal User)', async function () {
        // Test that steps are updated correctly for the "per day" interval for a normal user task.
    });

    it('Should update steps for "per day" interval (Group)', async function () {
        // Test that steps are updated correctly for the "per day" interval for a group task.
    });

    it('Should update steps for "per week" interval (Normal User)', async function () {
        // Test that steps are updated correctly for the "per week" interval for a normal user task.
    });

    it('Should update steps for "per week" interval (Group)', async function () {
        // Test that steps are updated correctly for the "per week" interval for a group task.
    });

    it('Should update steps for "per month" interval (Normal User)', async function () {
        // Test that steps are updated correctly for the "per month" interval for a normal user task.
    });

    it('Should update steps for "per month" interval (Group)', async function () {
        // Test that steps are updated correctly for the "per month" interval for a group task.
    });

    it('Should update steps for "per year" interval (Normal User)', async function () {
        // Test that steps are updated correctly for the "per year" interval for a normal user task.
    });

    it('Should update steps for "per year" interval (Group)', async function () {
        // Test that steps are updated correctly for the "per year" interval for a group task.
    });

    //Edge cases

    it('Should handle tasks with no steps (Normal User)', async function () {
        // Test that no updates occur for a normal user task with no steps.
    });

    it('Should handle tasks with no steps (Group)', async function () {
        // Test that no updates occur for a group task with no steps.
    });

    it('Should handle tasks with invalid task names (Normal User)', async function () {
        // Test that no updates occur for a normal user task with invalid task names (e.g., no numbers).
    });

    it('Should handle steps with invalid step names (Group)', async function () {
        // Test that no updates occur for a group task with invalid step names (e.g., no numbers).
    });

});