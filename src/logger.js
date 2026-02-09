const formatTimestamp = () => new Date().toISOString();

export const logger = {
    info: (message, meta) => {
        if (meta) {
            console.log(`[${formatTimestamp()}] INFO: ${message}`, meta);
            return;
        }
        console.log(`[${formatTimestamp()}] INFO: ${message}`);
    },
    warn: (message, meta) => {
        if (meta) {
            console.warn(`[${formatTimestamp()}] WARN: ${message}`, meta);
            return;
        }
        console.warn(`[${formatTimestamp()}] WARN: ${message}`);
    },
    error: (message, meta) => {
        if (meta) {
            console.error(`[${formatTimestamp()}] ERROR: ${message}`, meta);
            return;
        }
        console.error(`[${formatTimestamp()}] ERROR: ${message}`);
    }
};

export default logger;
