const webpush = require("web-push");

webpush.setVapidDetails(
    "https://example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

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

        if (
            username !== "landon" &&
            username !== "mama"
        ) {
            return res.status(400).json({
                error: "Invalid username"
            });
        }

        /*
         * The subscription will be connected
         * to shared storage in the next step.
         */

        console.log("Push subscription received:", {
            username,
            subscription
        });

        return res.status(200).json({
            success: true,
            message: "Device registered successfully"
        });

    } catch (error) {

        console.error(
            "Subscription error:",
            error
        );

        return res.status(500).json({
            error: "Failed to register device"
        });

    }
};
