const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const {
            username,
            notificationId,
            answer,
            food
        } = req.body;

        if (!username || !notificationId || !answer) {
            return res.status(400).json({
                error: "Missing required information"
            });
        }

        // Only Landon can answer food notifications
        if (username !== "landon") {
            return res.status(403).json({
                error: "Only Landon can answer these notifications"
            });
        }

        // Only Yes or No is allowed
        if (answer !== "Yes" && answer !== "No") {
            return res.status(400).json({
                error: "Answer must be Yes or No"
            });
        }

        // If Yes, Landon must say what he ate
        if (
            answer === "Yes" &&
            (!food || !String(food).trim())
        ) {
            return res.status(400).json({
                error: "Please enter what you ate"
            });
        }

        // Get notification history
        const notifications =
            await redis.lrange(
                "notifications",
                0,
                99
            );

        let found = false;
        let updatedNotification = null;

        for (let i = 0; i < notifications.length; i++) {

            let notification = notifications[i];

            if (typeof notification === "string") {
                try {
                    notification =
                        JSON.parse(notification);
                } catch {
                    continue;
                }
            }

            if (
                notification.id !==
                notificationId
            ) {
                continue;
            }

            // Make sure this is a food notification
            if (
                notification.type !==
                "food"
            ) {
                return res.status(400).json({
                    error:
                        "This notification cannot be answered"
                });
            }

            const answeredAt =
                new Date().toISOString();

            notification.answer =
                answer;

            notification.answeredAt =
                answeredAt;

            notification.answeredBy =
                "landon";

            if (answer === "Yes") {
                notification.food =
                    String(food).trim();
            } else {
                notification.food = null;
            }

            // Save the updated notification
            await redis.lset(
                "notifications",
                i,
                JSON.stringify(notification)
            );

            // Also save an individual copy
            await redis.set(
                `notification:${notificationId}`,
                notification
            );

            found = true;
            updatedNotification =
                notification;

            break;
        }

        if (!found) {
            return res.status(404).json({
                error:
                    "Notification not found"
            });
        }

        return res.status(200).json({
            success: true,
            notificationId,
            answer,
            food:
                answer === "Yes"
                    ? String(food).trim()
                    : null,
            answeredAt:
                updatedNotification.answeredAt
        });

    } catch (error) {

        console.error(
            "Answer error:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to save answer"
        });
    }
};
