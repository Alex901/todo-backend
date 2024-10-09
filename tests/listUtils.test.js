const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server'); // Adjust the path to your server file
const User = require('../models/User');
const Group = require('../models/Group');
const List = require('../models/List');
const Todo = require('../models/Todo');
const mockdate = require('mockdate');
const expect = require('chai').expect;
const { checkAndUpdateIsToday } = require('../utils/listUtils');

describe('List Utils', function () {
    let userA, userB, group, list, todayList;
    let tasks = {};
    
    before(async function () {
        userA = new User({ username: 'userA', password: 'password', email: 'userA@test.com' });
        userB = new User({ username: 'userB', password: 'password', email: 'userB@test.com' });
        await userA.save();
        await userB.save();

        userA = await User.findById(userA._id).populate('myLists');
        todayList = userA.myLists.find(list => list.listName === 'today');
        // console.log('Today List for userA:', todayList);

        // Create a group and invite user B
        group = new Group({ name: 'Test Group', owner: userA._id, members: [{ member_id: userA._id }, { member_id: userB._id }] });
        await group.save();

        // Create a list in the group
        list = new List({ listName: 'Test List', owner: group._id });
        await list.save();

        // Add the list to user A's lists
        await User.findByIdAndUpdate(userA._id, { $push: { myLists: { $each: [list._id] } } });

        await User.findByIdAndUpdate(userA._id, { $set: { groups: [group._id] } });
        await User.findByIdAndUpdate(userB._id, { $set: { groups: [group._id] } });


        // Create tasks
        tasks.daily = new Todo({
            task: 'Daily Task',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'daily',
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.daily2 = new Todo({
            task: 'Daily Task started not completed',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'daily',
            isToday: false,
            isStarted: true,
            isDone: false,
            created: new Date()
        });

        tasks.daily3 = new Todo({
            task: 'Daily Task started and completed',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'daily',
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            completed: new Date(),
            started: new Date(),
            totalTimeSpent: 500
        });

        tasks.daily4 = new Todo({
            task: 'Daily Task started and completed but repeatUntil is passed',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'daily',
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            completed: new Date('2022-12-31'),
            started: new Date(),
            totalTimeSpent: 500,
            repeatUntil: new Date('2022-12-31')
        });

        tasks.daily5 = new Todo({
            task: 'Daily Task started but not completed, repeatStreak reset',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'daily',
            isToday: false,
            isStarted: true,
            isDone: false,
            created: new Date(),
            started: new Date(),
            totalTimeSpent: 500,
            repeatStreak: 5,
        });

        tasks.daily6 = new Todo({
            task: 'Daily Task was not started, repeatStreak reset',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'daily',
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date(),
            totalTimeSpent: 500,
            repeatStreak: 5,
        });

        tasks.weekly1 = new Todo({
            task: 'Weekly Task 1',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'weekly',
            repeatDays: ['Monday'],
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.weekly2 = new Todo({
            task: 'Weekly Task 2',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'weekly',
            repeatDays: ['Monday', 'Wednesday'],
            isToday: false,
            isStarted: false,
            isDone: true,
            created: new Date(),
            repeatUntil: new Date('2022-12-31')
        });

        tasks.weekly3 = new Todo({
            task: 'Weekly Task 3',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'weekly',
            repeatDays: ['Friday'],
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            started: new Date(),
            completed: new Date(),
            totalTimeSpent: 500,
        });

        tasks.weekly4 = new Todo({
            task: 'Weekly Task 4: upp repeatStreak ',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'weekly',
            repeatDays: ['Monday'],
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            started: new Date(),
            completed: new Date(),
            totalTimeSpent: 500,
            repeatStreak: 5,
        });

        tasks.weekly5 = new Todo({
            task: 'Weekly Task 5: break repeatStreak ',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'weekly',
            repeatDays: ['Wednesday'],
            isToday: false,
            isStarted: true,
            isDone: false,
            created: new Date(),
            totalTimeSpent: 500,
            repeatStreak: 5,
        });

        tasks.monthlyStart = new Todo({
            task: 'Monthly Task Start',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'monthly',
            repeatMonthlyOption: 'start',
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.monthlyEnd = new Todo({
            task: 'Monthly Task End',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'monthly',
            repeatMonthlyOption: 'end',
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.monthlyStart2 = new Todo({
            task: 'Monthly Task Start',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'monthly',
            repeatMonthlyOption: 'start',
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            repeatUntil: new Date('2022-12-31')
        });

        tasks.monthlyEnd2 = new Todo({
            task: 'Monthly Task End 2',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'monthly',
            repeatMonthlyOption: 'end',
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            repeatUntil: new Date('2022-12-31')
        });

        tasks.monthlyStart3 = new Todo({
            task: 'Monthly Task Start',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'monthly',
            repeatMonthlyOption: 'start',
            isToday: false,
            isStarted: true,
            isDone: true,
            created: new Date(),
            repeatStreak: 5,
            started: new Date(),
            completed: new Date(),
            totalTimeSpent: 500,
        });

        tasks.monthlyEnd3 = new Todo({
            task: 'Monthly Task End 3',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'monthly',
            repeatMonthlyOption: 'end',
            isToday: false,
            isStarted: true,
            isDone: false,
            created: new Date(),
            repeatStreak: 5,
        });

        tasks.yearlyStart = new Todo({
            task: 'Yearly Task Start',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'yearly',
            repeatYearlyOption: 'start',
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.yearlyEnd = new Todo({
            task: 'Yearly Task End',
            owner: userA._id,
            inListNew: [list._id],
            repeatable: true,
            repeatInterval: 'yearly',
            repeatYearlyOption: 'end',
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.normalTaskWithDeadlineButDone = new Todo({
            task: 'Normal Task with Deadline',
            owner: userA._id,
            inListNew: [list._id],
            dueDate: new Date('2022-12-31'),
            isToday: false,
            isStarted: false,
            isDone: true,
            created: new Date(),
            completed: new Date(),
        });

        tasks.normalTaskWithDeadline = new Todo({
            task: 'Normal Task with Deadline',
            owner: userA._id,
            inListNew: [list._id],
            dueDate: new Date('2022-12-31'),
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.normalTaskWithDeadlineAndEstimatedTime = new Todo({
            task: 'Normal Task with Deadline and short ET',
            owner: userA._id,
            inListNew: [list._id],
            dueDate: new Date('2023-12-30'),
            isToday: false,
            estimatedTime: 500,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.normalTaskWithDeadlineAndLongEstimatedTime = new Todo({
            task: 'Normal Task with Deadline and long ET',
            owner: userA._id,
            inListNew: [list._id],
            dueDate: new Date('2023-01-03'),
            isToday: false,
            estimatedTime: 2880,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.normalTaskWithoutDeadline = new Todo({
            task: 'Normal Task without Deadline',
            owner: userA._id,
            inListNew: [list._id],
            isToday: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.normalTaskWithDeadlineButDone = new Todo({
            task: 'Normal Task without Deadline',
            owner: userA._id,
            inListNew: [list._id],
            dueDate: new Date('2023-01-01'),
            isToday: false,
            isStarted: false,
            isDone: true,
            created: new Date()
        });


        
        for (const task of Object.values(tasks)) {
            await task.save();
        }
    });



    this.afterEach(function () {
        mockdate.reset();
    });

    after(async function () {
        await User.deleteMany();
        await Group.deleteMany();
        await List.deleteMany();
        await Todo.deleteMany();
    });

    it('Check so test is properly setup', async function () {
        const fetchedTasks = await Todo.find({ owner: userA._id });

        expect(fetchedTasks.length).to.equal(Object.keys(tasks).length);

        fetchedTasks.forEach(task => {
            expect(task.isToday).to.be.false;
        });

        const users = await User.find();
        expect(users.length).to.equal(2);

        for (const user of users) {
            const populatedUser = await User.findById(user._id).populate('myLists');
            const todayList = populatedUser.myLists.find(list => list.listName === 'today');
            expect(todayList).to.not.be.undefined;
        }
    });



    it('Check repeatable daily -- owned by user', async function () {
        mockdate.set('2028-06-07');
        await checkAndUpdateIsToday();


        let updatedTask = await Todo.findById(tasks.daily._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.inListNew).to.include(todayList._id);

        // Check the second daily task (started but not completed)
        updatedTask = await Todo.findById(tasks.daily2._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.inListNew).to.include(todayList._id);

        // Check the third daily task (started and completed)
        updatedTask = await Todo.findById(tasks.daily3._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false; // Reset for the new day
        expect(updatedTask.isDone).to.be.false; // Reset for the new day
        expect(updatedTask.totalTimeSpent).to.equal(0); // Reset for the new day
        expect(updatedTask.inListNew).to.include(todayList._id);

        // Check the fourth daily task (repeatUntil is passed)
        updatedTask = await Todo.findById(tasks.daily4._id);
        expect(updatedTask.inListNew).to.not.include(todayList._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.isStarted).to.be.true; // Should remain as it was
        expect(updatedTask.isDone).to.be.true; // Should remain as it was
        expect(updatedTask.inListNew).to.not.include(todayList._id);

        updatedTask = await Todo.findById(tasks.daily5._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.repeatStreak).to.equal(0); // Repeat streak should be reset

        // Check the sixth daily task (was not started, repeatStreak reset)
        updatedTask = await Todo.findById(tasks.daily6._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.repeatStreak).to.equal(0);


        // Remove the tasks that have been tested
        await Todo.deleteOne({ _id: tasks.daily._id });
        await Todo.deleteOne({ _id: tasks.daily2._id });
        await Todo.deleteOne({ _id: tasks.daily3._id });
        await Todo.deleteOne({ _id: tasks.daily4._id });
        await Todo.deleteOne({ _id: tasks.daily5._id });
        await Todo.deleteOne({ _id: tasks.daily6._id });
    });

    it('Check repeatable weekly tasks on Monday', async function () {
        mockdate.set('2028-06-05'); // Set to a Monday
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.weekly1._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
    
        updatedTask = await Todo.findById(tasks.weekly2._id);
        expect(updatedTask.inListNew).to.not.include(todayList._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.true;
    
        updatedTask = await Todo.findById(tasks.weekly4._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.repeatStreak).to.equal(6); // Repeat streak should be incremented
    });

    it('Check repeatable weekly tasks on Wednesday', async function () {
        mockdate.set('2028-06-07'); // Set to a Wednesday
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.weekly2._id);
        expect(updatedTask.inListNew).to.not.include(todayList._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.true; //should be unchanged
    
        updatedTask = await Todo.findById(tasks.weekly5._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.repeatStreak).to.equal(0); // Repeat streak should be reset
    });

    it('Check repeatable weekly tasks on Friday', async function () {
        mockdate.set('2028-06-09'); // Set to a Friday
        await checkAndUpdateIsToday();


    
        let updatedTask = await Todo.findById(tasks.weekly3._id);
        // console.log('Today list._id', todayList._id);
        // console.log('Updated Task (weekly3):', updatedTask);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
        expect(updatedTask.totalTimeSpent).to.equal(0); // Reset for the new day
    });

    it('Check repeatable weekly tasks on Sunday', async function () {
        mockdate.set('2028-06-11'); // Set to a Sunday
        await checkAndUpdateIsToday();

        // Ensure no tasks are updated
        let updatedTask = await Todo.findById(tasks.weekly1._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.weekly2._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.weekly3._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.weekly4._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.weekly5._id);
        expect(updatedTask.isToday).to.be.false;
    
        // Remove the tasks that have been tested
        await Todo.deleteOne({ _id: tasks.weekly1._id });
        await Todo.deleteOne({ _id: tasks.weekly2._id });
        await Todo.deleteOne({ _id: tasks.weekly3._id });
        await Todo.deleteOne({ _id: tasks.weekly4._id });
        await Todo.deleteOne({ _id: tasks.weekly5._id });
    });

    it('Check repeatable monthly tasks at the start of the month', async function () {
        mockdate.set('2028-06-01'); // Set to the start of the month
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.monthlyStart._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
    
        updatedTask = await Todo.findById(tasks.monthlyStart2._id);
        expect(updatedTask.inListNew).to.not.include(todayList._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.isStarted).to.be.true;
        expect(updatedTask.isDone).to.be.true;
    
        updatedTask = await Todo.findById(tasks.monthlyStart3._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false; // Reset for the new month
        expect(updatedTask.isDone).to.be.false; // Reset for the new month
        expect(updatedTask.totalTimeSpent).to.equal(0); // Reset for the new month
        expect(updatedTask.repeatStreak).to.equal(6); // Repeat streak should be incremented

    });


    it('Check repeatable monthly tasks at the end of the month', async function () {
        mockdate.set('2028-06-30'); // Set to the end of the month
        await checkAndUpdateIsToday();

        // console.log('Today list._id', todayList._id);

        //Works
        let updatedTask = await Todo.findById(tasks.monthlyEnd._id);
        // console.log('Updated Task (monthlyEnd):', updatedTask);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
    
        //Works
        updatedTask = await Todo.findById(tasks.monthlyEnd2._id);
        // console.log('Updated Task (monthlyEnd2):', updatedTask);
        expect(updatedTask.inListNew).to.not.include(todayList._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.isStarted).to.be.true;
        expect(updatedTask.isDone).to.be.true;
        
        //A task is today, should be reset and placed in the today list but as it was not completed
        //in the prior month, the streak should be reset
        updatedTask = await Todo.findById(tasks.monthlyEnd3._id);
        // console.log('Updated Task (monthlyEnd3):', updatedTask);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false; // Reset for the new month
        expect(updatedTask.isDone).to.be.false; // Reset for the new month
        expect(updatedTask.repeatStreak).to.equal(0); // Repeat streak should be incremented
    
    });

    it('Check that no monthly tasks reset on a non-repeating day', async function () {
        mockdate.set('2028-06-15'); // Set to a mid-month day where no tasks should reset
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.monthlyStart._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.monthlyEnd._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.monthlyStart2._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.monthlyEnd2._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.monthlyStart3._id);
        expect(updatedTask.isToday).to.be.false;
    
        updatedTask = await Todo.findById(tasks.monthlyEnd3._id);
        expect(updatedTask.isToday).to.be.false;
    
        // Remove all the monthly tasks that have been tested
        await Todo.deleteOne({ _id: tasks.monthlyStart._id });
        await Todo.deleteOne({ _id: tasks.monthlyEnd._id });
        await Todo.deleteOne({ _id: tasks.monthlyStart2._id });
        await Todo.deleteOne({ _id: tasks.monthlyEnd2._id });
        await Todo.deleteOne({ _id: tasks.monthlyStart3._id });
        await Todo.deleteOne({ _id: tasks.monthlyEnd3._id });
    });

    it('Check repeatable yearly tasks at the start of the year', async function () {
        mockdate.set('2028-01-01'); // Set to the start of the year
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.yearlyStart._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
    
        // Remove the task that has been tested
        await Todo.deleteOne({ _id: tasks.yearlyStart._id });
    });

    it('Check repeatable yearly tasks at the end of the year', async function () {
        mockdate.set('2028-12-31'); // Set to the end of the year
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.yearlyEnd._id);
        expect(updatedTask.inListNew).to.include(todayList._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.isStarted).to.be.false;
        expect(updatedTask.isDone).to.be.false;
    
        // Remove the task that has been tested
        await Todo.deleteOne({ _id: tasks.yearlyEnd._id });
    });
    it('Check normal task with deadline', async function () {
        mockdate.set('2022-12-31');
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.normalTaskWithDeadline._id);
        expect(updatedTask.isToday).to.be.true;
        expect(updatedTask.inListNew).to.include(todayList._id);
    });
    
    it('Check normal task with deadline and estimated time', async function () {
        mockdate.set('2023-12-29');
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.normalTaskWithDeadlineAndEstimatedTime._id);
        expect(updatedTask.isToday).to.be.true; // Adjusted deadline is today
        expect(updatedTask.inListNew).to.include(todayList._id);
    });
    
    it('Check normal task with deadline and long estimated time', async function () {
        mockdate.set('2022-12-31');
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.normalTaskWithDeadlineAndLongEstimatedTime._id);
        expect(updatedTask.isToday).to.be.false; // Adjusted deadline is not today
        expect(updatedTask.inListNew).to.not.include(todayList._id);
    
        // Set the date to the adjusted deadline day
        mockdate.set('2023-01-01');
        await checkAndUpdateIsToday();
    
        updatedTask = await Todo.findById(tasks.normalTaskWithDeadlineAndLongEstimatedTime._id);
        expect(updatedTask.isToday).to.be.true; // Adjusted deadline is today
        expect(updatedTask.inListNew).to.include(todayList._id);
    });
    
    it('Check normal task without deadline', async function () {
        mockdate.set('2022-12-31');
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.normalTaskWithoutDeadline._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.inListNew).to.not.include(todayList._id);
    });
    
    it('Check normal task with deadline but done', async function () {
        mockdate.set('2022-12-31');
        await checkAndUpdateIsToday();
    
        let updatedTask = await Todo.findById(tasks.normalTaskWithDeadlineButDone._id);
        expect(updatedTask.isToday).to.be.false;
        expect(updatedTask.inListNew).to.not.include(todayList._id);
    });

    it('Check when there are no tasks for a user', async function () {
        await Todo.deleteMany({ owner: userA._id }); // Ensure there are no tasks for userA
        await checkAndUpdateIsToday();
        // No assertions needed, just ensure no errors are thrown
    });

    it('Check when there are no users or today list', async function () {
        await User.deleteMany(); // Ensure there are no users
        await List.deleteMany(); // Ensure there are no lists
        await checkAndUpdateIsToday();
        // No assertions needed, just ensure no errors are thrown
    });


});