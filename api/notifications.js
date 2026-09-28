const { Redis } = require("@upstash/redis");
const webpush = require("web-push");

const redis = Redis.fromEnv();

webpush.setVapidDetails(
    "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const now = new Date();

        // Indonesia Western Time (WIB / UTC+7)
        const indonesiaTime = new Date(
            now.toLocaleString("en-US", {
                timeZone: "Asia/Jakarta"
            })
        );

        const hour = indonesiaTime.getHours();
        const minute = indonesiaTime.getMinutes();
        const day = indonesiaTime.getDay();

        let notification = null;

        // Monday = 1
        // Tuesday = 2
        // Wednesday = 3
        // Thursday = 4
        // Friday = 5

        // 5:50 AM - Breakfast
        if (hour === 5 && minute === 50) {
            notification = {
                type: "food",
                recipient: "landon",
                title: "Breakfast",
                body: "Did you eat breakfast yet?",
                mamaTitle: "Send Notification to Landon",
                mamaBody: "Did Landon Eat Breakfast Yet?"
            };
        }

        // Monday 12:00 PM - Extracurricular reminder
        if (day === 1 && hour === 12 && minute === 0) {
            notification = {
                type: "reminder",
                recipient: "mama",
                title: "Extracurricular Reminder",
                body: "Landon has extracurricular activities. He might be eating late. Make sure he doesn't eat anything sour, such as tomato sauce, etc."
            };
        }

        // Tuesday-Friday 12:00 PM - Lunch
        if (
            day >= 2 &&
            day <= 5 &&
            hour === 12 &&
            minute === 0
        ) {
            notification = {
                type: "food",
                recipient: "landon",
                title: "Lunch",
                body: "Did you eat lunch yet?",
                mamaTitle: "Send Notification to Landon",
                mamaBody: "Did Landon Eat Lunch Yet?"
            };
        }

        // 7:00 PM - Dinner
        if (hour === 19 && minute === 0) {
            notification = {
                type: "food",
                recipient: "landon",
                title: "Dinner",
                body: "Did you eat dinner yet?",
                mamaTitle: "Send Notification to Landon",
                mamaBody: "Did Landon Eat Dinner Yet?"
            };
        }

        if (!notification) {
            return res.status(200).json({
                sent: false,
                message: "No scheduled notification right now."
            });
        }

        // Create a unique notification ID
        const notificationId =
            `${notification.type}-${Date.now()}`;

        const record = {
            id: notificationId,
            ...notification,
            createdAt: new Date().toISOString(),
            answer: null
        };

        // Save notification to Redis
        await redis.set(
            `notification:${notificationId}`,
            record
        );

        // Add to notification history
        await redis.lpush(
            "notifications",
            record
        );

        // Keep the history from growing forever
        await redis.ltrim(
            "notifications",
            0,
            99
        );

        // Send to Landon's devices
        if (notification.recipient === "landon") {
            const subscriptions =
                await redis.get("push:landon") || [];

            for (const subscription of subscriptions) {
                try {
                    await webpush.sendNotification(
                        subscription,
                        JSON.stringify({
                            title: notification.title,
                            body: notification.body,
                            tag: notificationId,
                            url: "/"
                        })
                    );
                } catch (error) {
                    console.error(
                        "Failed to send push notification:",
                        error
                    );
                }
            }
        }

        // Send Mama's reminder
        if (notification.recipient === "mama") {
            const subscriptions =
                await redis.get("push:mama") || [];

            for (const subscription of subscriptions) {
                try {
                    await webpush.sendNotification(
                        subscription,
                        JSON.stringify({
                            title: notification.title,
                            body: notification.body,
                            tag: notificationId,
                            url: "/"
                        })
                    );
                } catch (error) {
                    console.error(
                        "Failed to send Mama push notification:",
                        error
                    );
                }
            }
        }

        return res.status(200).json({
            sent: true,
            notification: record
        });

    } catch (error) {
        console.error(
            "Notification system error:",
            error
        );

        return res.status(500).json({
            error: "Notification system error"
        });
    }
};
