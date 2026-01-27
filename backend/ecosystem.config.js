module.exports = {
    apps: [
        {
            name: "pydah-backend",
            script: "./server.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1536M", // Restart if memory exceeds 1.5GB
            env: {
                NODE_ENV: "production",
                TZ: "Asia/Kolkata"
            },
            // Optional: Restart every 24 hours to clear any slow memory leaks
            cron_restart: "0 3 * * *",
            time: true
        }
    ]
};
