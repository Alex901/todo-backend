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
    let userA, userB, group, tasks = {};

    before(async function () {
        // Create users
        userA = new User({
            username: 'userA',
            email: 'userA@test.com',
            password: 'password',
            settings: { currency: 100 }
        });
        await userA.save();

        userB = new User({
            username: 'userB',
            email: 'userB@test.com',
            password: 'password',
            settings: { currency: 50 }
        });
        await userB.save();

        // Create a group owned by userA
        group = new Group({
            name: 'Test Group',
            owner: userA._id,
            members: [{ member_id: userA._id }, { member_id: userB._id }]
        });
        await group.save();

        const intervals = ['per repeat', 'per day', 'per week', 'per month', 'per year'];

        // Create tasks for each increment interval
        for (const interval of intervals) {
            await new Todo({
                task: `User Task (${interval})`,
                owner: userA._id,
                repeatable: false,
                dynamicSteps: {
                    isEnabled: true,
                    increment: 10,
                    incrementInterval: interval,
                    totalPrice: 0.1 // Price per step
                },
                steps: [{ taskName: 'Do 10 pushups', reps: 10 }],
                isStarted: false,
                isToday: interval === 'per repeat',
                isDone: false,
                created: new Date()
            }).save();

            await new Todo({
                task: `Group Task (${interval})`,
                owner: group._id,
                repeatable: false,
                dynamicSteps: {
                    isEnabled: true,
                    increment: 20,
                    incrementInterval: interval,
                    totalPrice: 0.1 // Price per step
                },
                steps: [{ taskName: 'Do 20 situps', reps: 20 }],
                isStarted: false,
                isToday: interval === 'per repeat',
                isDone: false,
                created: new Date()
            }).save();
        }

        // Tasks with dynamic steps disabled
        await new Todo({
            task: 'User Task (No Dynamic Steps)',
            owner: userA._id,
            dynamicSteps: { isEnabled: false },
            steps: [{ taskName: 'Do 15 squats', reps: 15 }],
            isStarted: false,
            isDone: false,
            created: new Date()
        }).save();

        await new Todo({
            task: 'Group Task (No Dynamic Steps)',
            owner: group._id,
            dynamicSteps: { isEnabled: false },
            steps: [{ taskName: 'Do 25 lunges', reps: 25 }],
            isStarted: false,
            isDone: false,
            created: new Date()
        }).save();

        // Tasks with no steps
        await new Todo({
            task: 'User Task (No Steps)',
            owner: userA._id,
            dynamicSteps: { isEnabled: true, increment: 10, incrementInterval: 'per day', totalPrice: 0.1 },
            isStarted: false,
            isDone: false,
            created: new Date()
        }).save();

        await new Todo({
            task: 'Group Task (No Steps)',
            owner: group._id,
            dynamicSteps: { isEnabled: true, increment: 20, incrementInterval: 'per day', totalPrice: 0.1 },
            isStarted: false,
            isDone: false,
            created: new Date()
        }).save();
    });

    after(async function () {
        await Promise.all([
            Todo.deleteMany(),
            User.deleteMany(),
            Group.deleteMany(),
            Notification.deleteMany(),
        ]);
    });

    it('Should verify test setup is correct', async function () {
        // Check users
        const userACheck = await User.findOne({ username: 'userA' });
        const userBCheck = await User.findOne({ username: 'userB' });
        expect(userACheck).to.not.be.null;
        expect(userBCheck).to.not.be.null;

        // Check group
        const groupCheck = await Group.findOne({ name: 'Test Group' });
        expect(groupCheck).to.not.be.null;
        expect(groupCheck.members.length).to.equal(2);

        // Check tasks
        const taskCount = await Todo.countDocuments();
        expect(taskCount).to.equal(14); // Verify the number of tasks created
        console.log('Test setup verified successfully!');
    });

    it('Should disable dynamic steps and create notification for insufficient funds (Normal User)', async function () {
        await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 0 }); // Simulate insufficient funds
        await updateDynamicSteps();

        const updatedTask = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
        console.log('DEBUG: Updated Task:', updatedTask);
        expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled

        const notification = await Notification.findOne({ to: userA._id });
        expect(notification).to.not.be.null;
        expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');
    });

    // it('Should deduct funds and update steps for sufficient funds (Normal User)', async function () {
    //     await User.findOneAndUpdate({ username: 'userA' }, { 'settings.currency': 100 }); // Ensure sufficient funds
    //     await updateDynamicSteps();

    //     const updatedUser = await User.findOne({ username: 'userA' });
    //     const updatedTask = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });

    //     expect(updatedUser.settings.currency).to.equal(99.9); // Deduct 0.1 currency for one step
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should disable dynamic steps and create notification for insufficient funds (Group)', async function () {
    //     await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 0 }); // Simulate insufficient funds
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findOne({ task: 'Group Task (per day)', owner: group._id });
    //     expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled

    //     const notification = await Notification.findOne({ user: group.owner });
    //     expect(notification).to.not.be.null;
    //     expect(notification.message).to.include('Dynamic steps were disabled due to insufficient funds');
    // });

    // it('Should deduct funds and update steps for sufficient funds (Group)', async function () {
    //     await User.findOneAndUpdate({ _id: group.owner }, { 'settings.currency': 100 }); // Ensure sufficient funds
    //     await updateDynamicSteps();

    //     const updatedUser = await User.findOne({ _id: group.owner });
    //     const updatedTask = await Todo.findOne({ task: 'Group Task (per day)', owner: group._id });

    //     expect(updatedUser.settings.currency).to.equal(99.8); // Deduct 0.2 currency for one step
    //     expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName
    // });

    // it('Should recognize and update reps for "Do five pushups"', async function () {
    //     const task = new Todo({
    //         task: 'Do five pushups',
    //         owner: userA._id,
    //         dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
    //         steps: [{ taskName: 'Do five pushups', reps: 5 }],
    //         isStarted: false,
    //         isDone: false,
    //         created: new Date()
    //     });
    //     await task.save();

    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(6); // 5 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 6 pushups'); // Updated taskName
    // });

    // it('Should recognize and update reps for "Find 9 fish"', async function () {
    //     const task = new Todo({
    //         task: 'Find 9 fish',
    //         owner: userA._id,
    //         dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
    //         steps: [{ taskName: 'Find 9 fish', reps: 9 }],
    //         isStarted: false,
    //         isDone: false,
    //         created: new Date()
    //     });
    //     await task.save();

    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(10); // 9 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Find 10 fish'); // Updated taskName
    // });

    // it('Should keep steps unchanged when dynamic steps are inactivated (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
    //     await Todo.findByIdAndUpdate(task._id, { 'dynamicSteps.isEnabled': false });
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(10); // No change
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // No change
    // });

    // it('Should update steps for "per repeat" interval (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per repeat)', owner: userA._id });
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should update steps for "per year" interval (Group)', async function () {
    //     const task = await Todo.findOne({ task: 'Group Task (per year)', owner: group._id });
    //     mockdate.set(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)); // Simulate one year later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName
    // });

    // it('Should recognize and update reps for "Do five pushups"', async function () {
    //     const task = new Todo({
    //         task: 'Do five pushups',
    //         owner: userA._id,
    //         dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
    //         steps: [{ taskName: 'Do five pushups', reps: 5 }],
    //         isStarted: false,
    //         isDone: false,
    //         created: new Date()
    //     });
    //     await task.save();

    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(6); // 5 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 6 pushups'); // Updated taskName
    // });

    // it('Should recognize and update reps for "Find 9 fish"', async function () {
    //     const task = new Todo({
    //         task: 'Find 9 fish',
    //         owner: userA._id,
    //         dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
    //         steps: [{ taskName: 'Find 9 fish', reps: 9 }],
    //         isStarted: false,
    //         isDone: false,
    //         created: new Date()
    //     });
    //     await task.save();

    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(10); // 9 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Find 10 fish'); // Updated taskName
    // });

    // it('Should recognize and update reps for "Do five pushups"', async function () {
    //     const task = new Todo({
    //         task: 'Do five pushups',
    //         owner: userA._id,
    //         dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
    //         steps: [{ taskName: 'Do five pushups', reps: 5 }],
    //         isStarted: false,
    //         isDone: false,
    //         created: new Date()
    //     });
    //     await task.save();

    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(6); // 5 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 6 pushups'); // Updated taskName
    // });

    // it('Should recognize and update reps for "Find 9 fish"', async function () {
    //     const task = new Todo({
    //         task: 'Find 9 fish',
    //         owner: userA._id,
    //         dynamicSteps: { isEnabled: true, increment: 10, totalPrice: 0.1 },
    //         steps: [{ taskName: 'Find 9 fish', reps: 9 }],
    //         isStarted: false,
    //         isDone: false,
    //         created: new Date()
    //     });
    //     await task.save();

    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(10); // 9 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Find 10 fish'); // Updated taskName
    // });

    // it('Should keep steps unchanged when dynamic steps are inactivated (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
    //     await Todo.findByIdAndUpdate(task._id, { 'dynamicSteps.isEnabled': false });
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(10); // No change
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // No change
    // });

    // it('Should ignore dynamic steps for repeatable task without steps (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (No Steps)', owner: userA._id });
    //     await Todo.findByIdAndUpdate(task._id, { 'dynamicSteps.isEnabled': false });
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.dynamicSteps.isEnabled).to.be.false; // Dynamic steps disabled
    // });

    // it('Should keep steps unchanged when dynamic steps are inactivated for repeatable task with steps (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
    //     await Todo.findByIdAndUpdate(task._id, { 'dynamicSteps.isEnabled': false });
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(10); // No change
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 10 pushups'); // No change
    // });

    // it('Should update steps for "per repeat" interval (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per repeat)', owner: userA._id });
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should update steps for "per day" interval (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per day)', owner: userA._id });
    //     mockdate.set(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Simulate one day later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should update steps for "per week" interval (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per week)', owner: userA._id });
    //     mockdate.set(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Simulate one week later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should update steps for "per month" interval (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per month)', owner: userA._id });
    //     mockdate.set(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Simulate one month later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should update steps for "per year" interval (Normal User)', async function () {
    //     const task = await Todo.findOne({ task: 'User Task (per year)', owner: userA._id });
    //     mockdate.set(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)); // Simulate one year later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(11); // 10 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 11 pushups'); // Updated taskName
    // });

    // it('Should update steps for "per week" interval (Group)', async function () {
    //     const task = await Todo.findOne({ task: 'Group Task (per week)', owner: group._id });
    //     mockdate.set(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Simulate one week later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName
    // });

    // it('Should update steps for "per month" interval (Group)', async function () {
    //     const task = await Todo.findOne({ task: 'Group Task (per month)', owner: group._id });
    //     mockdate.set(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Simulate one month later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName
    // });

    // it('Should update steps for "per year" interval (Group)', async function () {
    //     const task = await Todo.findOne({ task: 'Group Task (per year)', owner: group._id });
    //     mockdate.set(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)); // Simulate one year later
    //     await updateDynamicSteps();

    //     const updatedTask = await Todo.findById(task._id);
    //     expect(updatedTask.steps[0].reps).to.equal(22); // 20 + 10% increment
    //     expect(updatedTask.steps[0].taskName).to.equal('Do 22 situps'); // Updated taskName
    // });
});