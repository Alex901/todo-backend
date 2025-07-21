const { expect } = require('chai');
const { sortTasks, scheduleTasks } = require('../services/entryService');
const Todo = require('../models/Todo');
const mongoose = require('mongoose');

describe('Entry Service', function () {
    let tasks;

    before(async function () {
        // Ensure the environment is set to "test"
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('NODE_ENV is not set to "test". Tests should only run in the test environment.');
        }

        // Wait for the database connection to be ready
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.DATABASE_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        }
    });

    beforeEach(async () => {
        // Setup: Create necessary data before each test
        tasks = [
            await Todo.create({
                task: 'Task 1',
                priority: 'HIGH',
                difficulty: 'NORMAL',
                estimatedTime: 120,
                isUrgent: true,
                isStarted: false,
                isDone: false,
                created: new Date()
            }),
            await Todo.create({
                task: 'Task 2',
                priority: 'VERY HIGH',
                difficulty: 'HARD',
                estimatedTime: 60,
                isUrgent: false,
                isStarted: false,
                isDone: false,
                created: new Date()
            }),
            await Todo.create({
                task: 'Task 3',
                priority: 'NORMAL',
                difficulty: 'VERY EASY',
                estimatedTime: 30,
                isUrgent: true,
                isStarted: false,
                isDone: false,
                created: new Date()
            }),
            await Todo.create({
                task: 'Task 4',
                priority: '',
                difficulty: '',
                estimatedTime: null,
                isUrgent: false,
                isStarted: false,
                isDone: false,
                created: new Date()
            }),
            await Todo.create({
                task: 'Task 5',
                priority: 'LOW',
                difficulty: 'EASY',
                estimatedTime: 45,
                isUrgent: true,
                isStarted: false,
                isDone: false,
                created: new Date()
            })
        ];
    });

    afterEach(async () => {
        // Cleanup: Remove all data after each test
        await Todo.deleteMany();
    });

    after(async function () {
        // Close the database connection after all tests
        await mongoose.connection.close();
    });

    describe('sortTasks', function () {
        it('should sort tasks by priority in descending order', function () {
            const sorted = sortTasks(tasks, 'priority', 'descending');
            expect(sorted.map(task => task.priority)).to.deep.equal(['VERY HIGH', 'HIGH', 'NORMAL', 'LOW', '']);
        });

        it('should sort tasks by priority in ascending order', function () {
            const sorted = sortTasks(tasks, 'priority', 'ascending');
            expect(sorted.map(task => task.priority)).to.deep.equal(['', 'LOW', 'NORMAL', 'HIGH', 'VERY HIGH']);
        });

        it('should sort tasks by difficulty in descending order', function () {
            const sorted = sortTasks(tasks, 'difficulty', 'descending');
            expect(sorted.map(task => task.difficulty)).to.deep.equal(['HARD', 'NORMAL', 'EASY', 'VERY EASY', '']);
        });

        it('should sort tasks by estimatedTime in ascending order', function () {
            const sorted = sortTasks(tasks, 'estimatedTime', 'ascending');
            expect(sorted.map(task => task.estimatedTime)).to.deep.equal([30, 45, 60, 120, null]);
        });

        it('should sort tasks by urgency', function () {
            const sorted = sortTasks(tasks, 'urgent', 'descending');
            expect(sorted.map(task => task.isUrgent)).to.deep.equal([true, true, true, false, false]);
        });

        it('should throw an error for invalid attribute', function () {
            expect(() => sortTasks(tasks, 'invalid', 'ascending')).to.throw('Invalid attribute for sorting');
        });
    });

    describe('scheduleTasks', function () {
        it('should schedule tasks without overlapping deadlines', async function () {
            const tasks = [
                await Todo.create({ task: 'Task 1', estimatedTime: 120, isStarted: false, isDone: false, created: new Date() }),
                await Todo.create({ task: 'Task 2', estimatedTime: 90, isStarted: false, isDone: false, created: new Date() }),
                await Todo.create({ task: 'Task 3', estimatedTime: 60, isStarted: false, isDone: false, created: new Date() })
            ];

            const scheduledTasks = await scheduleTasks(tasks, 5);

            expect(scheduledTasks).to.have.length(3);
            expect(scheduledTasks[0].dueDate).to.exist;
            expect(scheduledTasks[1].dueDate).to.exist;
            expect(scheduledTasks[2].dueDate).to.exist;

            // Ensure no overlapping deadlines
            const taskEndTimes = scheduledTasks.map(task => {
                const endTime = new Date(task.dueDate);
                endTime.setMinutes(endTime.getMinutes() + task.estimatedTime);
                return endTime;
            });

            for (let i = 1; i < taskEndTimes.length; i++) {
                expect(taskEndTimes[i]).to.be.greaterThan(taskEndTimes[i - 1]);
            }
        });
    });
});