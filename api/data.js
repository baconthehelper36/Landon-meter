const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

module.exports = async (req, res) => {
    if (req.method !== "GET") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const username = req.query.username;

        if (username !== "landon" && username !== "mama") {
            return res.status(400).json({
                error: "Invalid username"
            });
        }

        const notifications =
            await redis.lrange(
                "notifications",
                0,
                99
            );

        const cleaned = notifications.map(item => {
            if (typeof item === "string") {
                try {
                    return JSON.parse(item);
                } catch {
                    return item;
                }
            }

            return item;
        });

        return res.status(200).json({
            success: true,
            username,
            notifications: cleaned
        });

    } catch (error) {
        console.error(
            "Data error:",
            error
        );

        return res.status(500).json({
            error: "Failed to load notifications"
        });
    }
};
