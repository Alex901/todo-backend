const cron = require('node-cron');
const { checkAndUpdateIsToday } = require('./listUtils');
const { checkMissedDeadlines, updateDynamicSteps } = require('../services/entryService');


// Schedule the job to run every day at midnight
cron.schedule('0 0 0 * * *', async () => {
    console.log('Running daily scheduled jobs...');

    try {
        //Run updateToday job
        console.log('Running checkAndUpdateIsToday job...');
        await checkAndUpdateIsToday();

        // Run checkMissedDeadlines job
        console.log('Running checkMissedDeadlines job...');
        await checkMissedDeadlines();

        console.log('Running updateDynamicSteps job...');
        updateDynamicSteps();
        
        console.log('All scheduled jobs completed successfully.');
    } catch (error) {
        console.error('Error running scheduled jobs:', error);
    }
});