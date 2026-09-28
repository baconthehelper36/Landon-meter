const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { subscription, username } = req.body;

        if (!subscription || !username) {
            return res.status(400).json({
                error: "Missing subscription or username"
            });
        }

        if (username !== "landon" && username !== "mama") {
            return res.status(400).json({
                error: "Invalid username"
            });
        }

        const key = `push:${username}`;

        // Get existing devices
        const existing = await redis.get(key);

        let subscriptions = Array.isArray(existing)
            ? existing
            : [];

        // Prevent the same device from being saved twice
        const alreadyExists = subscriptions.some(
            item =>
                item.endpoint === subscription.endpoint
        );

        if (!alreadyExists) {
            subscriptions.push(subscription);
        }

        // Save devices
        await redis.set(key, subscriptions);

        return res.status(200).json({
            success: true,
            message: "Device registered successfully",
            devices: subscriptions.length
        });

    } catch (error) {
        console.error("Subscription error:", error);

        return res.status(500).json({
            error: "Failed to register device"
        });
    }
};
