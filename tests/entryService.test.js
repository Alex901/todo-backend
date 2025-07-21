const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server'); // Import the server to initialize the database connection
const User = require('../models/User');
const Group = require('../models/Group');
const List = require('../models/List');
const Todo = require('../models/Todo');
const expect = require('chai').expect;
const { sortTasks, scheduleTasks } = require('../services/entryService');
const mockdate = require('mockdate');

describe('Entry Service', function () {
    let user, group, list, tasks = {};

    // Ensure the environment is set to "test"
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('NODE_ENV is not set to "test". Tests should only run in the test environment.');
    }

    before(async function () {
        // Create a user for testing
        user = new User({
            username: 'testuser',
            email: 'testuser@test.com',
            password: 'password'
        });
        await user.save();

        // Create a group and add the user
        group = new Group({
            name: 'Test Group',
            owner: user._id,
            members: [{ member_id: user._id }]
        });
        await group.save();

        // Create a list in the group
        list = new List({
            listName: 'Test List',
            owner: group._id
        });
        await list.save();

        // Add the list to the user's lists
        await User.findByIdAndUpdate(user._id, { $push: { myLists: { $each: [list._id] } } });

        // Add the group to the user's groups
        await User.findByIdAndUpdate(user._id, { $set: { groups: [group._id] } });

        // Create tasks for testing
        tasks.task1 = new Todo({
            task: 'Task 1',
            owner: user._id,
            inListNew: [list._id],
            priority: 'HIGH',
            difficulty: 'NORMAL',
            estimatedTime: 120,
            isUrgent: true,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.task2 = new Todo({
            task: 'Task 2',
            owner: user._id,
            inListNew: [list._id],
            priority: 'VERY HIGH',
            difficulty: 'HARD',
            estimatedTime: 60,
            isUrgent: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.task3 = new Todo({
            task: 'Task 3',
            owner: user._id,
            inListNew: [list._id],
            priority: 'NORMAL',
            difficulty: 'VERY EASY',
            estimatedTime: 30,
            isUrgent: true,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.task4 = new Todo({
            task: 'Task 4',
            owner: user._id,
            inListNew: [list._id],
            priority: '',
            difficulty: '',
            estimatedTime: null,
            isUrgent: false,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.task5 = new Todo({
            task: 'Task 5',
            owner: user._id,
            inListNew: [list._id],
            priority: 'LOW',
            difficulty: 'EASY',
            estimatedTime: 45,
            isUrgent: true,
            isStarted: false,
            isDone: false,
            created: new Date()
        });

        tasks.task6 = new Todo({
            task: 'Task 6',
            owner: user._id,
            inListNew: [list._id],
            priority: 'VERY HIGH',
            difficulty: 'VERY HARD',
            estimatedTime: 90,
            isUrgent: false,
            isStarted: false,
            isDone: false,
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
        // Cleanup: Remove all tasks, lists, groups, and the user after tests
        await Todo.deleteMany();
        await List.deleteMany();
        await Group.deleteMany();
        await User.deleteMany();
    });

    it('Check so test is properly setup', async function () {
        const fetchedTasks = await Todo.find({ owner: user._id });
        expect(fetchedTasks.length).to.equal(Object.keys(tasks).length);

        fetchedTasks.forEach(task => {
            expect(task.isStarted).to.be.false;
            expect(task.isDone).to.be.false;
            expect(task.inListNew).to.include(list._id);
        });

        const fetchedUser = await User.findById(user._id).populate('myLists');
        expect(fetchedUser).to.not.be.null;
        expect(fetchedUser.myLists).to.have.length(3);
        expect(fetchedUser.myLists[2]._id.toString()).to.equal(list._id.toString());
    });

    it('Check sortTasks by priority in ascending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'priority', 'ascending');
        expect(sorted.map(task => task.priority)).to.deep.equal(['', 'LOW', 'NORMAL', 'HIGH', 'VERY HIGH', 'VERY HIGH']);
    });

    it('Check sortTasks by priority in descending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'priority', 'descending');
        expect(sorted.map(task => task.priority)).to.deep.equal(['VERY HIGH', 'VERY HIGH', 'HIGH', 'NORMAL', 'LOW', '']);
    });

    it('Check sortTasks by difficulty in ascending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'difficulty', 'ascending');
        expect(sorted.map(task => task.difficulty)).to.deep.equal(['', 'VERY EASY', 'EASY', 'NORMAL', 'HARD', 'VERY HARD']);
    });

    it('Check sortTasks by difficulty in descending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'difficulty', 'descending');
        expect(sorted.map(task => task.difficulty)).to.deep.equal(['VERY HARD', 'HARD', 'NORMAL', 'EASY', 'VERY EASY', '']);
    });

    it('Check sortTasks by estimatedTime in ascending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'estimatedTime', 'ascending');
        expect(sorted.map(task => task.estimatedTime)).to.deep.equal([120, 90, 60, 45, 30, null]);

    });

    it('Check sortTasks by estimatedTime in descending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'estimatedTime', 'descending');
        expect(sorted.map(task => task.estimatedTime)).to.deep.equal([null, 30, 45, 60, 90, 120]);
    });

    it('Check sortTasks by urgency in ascending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'urgent', 'ascending');
        expect(sorted.map(task => task.isUrgent)).to.deep.equal([true, true, true, false, false, false]);
    });

    it('Check sortTasks by urgency in descending order', function () {
        const sorted = sortTasks(Object.values(tasks), 'urgent', 'descending');
        expect(sorted.map(task => task.isUrgent)).to.deep.equal([true, true, true, false, false, false]);
    });

    it('Check sortTasks throws error for invalid attribute', function () {
        expect(() => sortTasks(Object.values(tasks), 'invalid', 'ascending')).to.throw('Invalid attribute for sorting');
    });
});