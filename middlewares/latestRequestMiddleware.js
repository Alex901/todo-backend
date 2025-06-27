const latestTimestamps = new Map();

/**
 * Middleware to track the latest request for a specific user or resource.
 */
function ensureLatestRequest(req, res, next) {
    const userId = req.params.id || req.body.userId; // Adjust based on your route structure
    const timestamp = Date.now();

    // Store the latest timestamp for this user or resource
    latestTimestamps.set(userId, timestamp);

    // Attach the timestamp to the request object
    req.timestamp = timestamp;

    next();
}

/**
 * Middleware to validate if the current request is the latest.
 */
function validateLatestRequest(req, res, next) {
    const userId = req.params.id || req.body.userId;

    // Check if this request is still the latest
    if (latestTimestamps.get(userId) !== req.timestamp) {
        console.log(`Ignored outdated request for user ${userId}`);
        return res.status(200).json({ message: 'Request ignored as a newer update exists' });
    }

    next();
}

module.exports = {
    ensureLatestRequest,
    validateLatestRequest
};