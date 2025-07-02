const mongoose = require('mongoose');

/**
 * Check database connection health
 * @returns {Object} Health status and details
 */
function checkDatabaseHealth() {
    const connectionState = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    return {
        isConnected: connectionState === 1,
        state: states[connectionState] || 'unknown',
        stateCode: connectionState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections).length : 0
    };
}

/**
 * Test database connection with a simple operation
 * @returns {Promise<Object>} Test result
 */
async function testDatabaseConnection() {
    try {
        const health = checkDatabaseHealth();
        
        if (!health.isConnected) {
            return {
                success: false,
                error: 'Database not connected',
                details: health
            };
        }

        // Try a simple operation
        await mongoose.connection.db.admin().ping();
        
        return {
            success: true,
            message: 'Database connection healthy',
            details: health
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            details: checkDatabaseHealth()
        };
    }
}

module.exports = {
    checkDatabaseHealth,
    testDatabaseConnection
};