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

        if (username !== "landon") {
            return res.status(403).json({
                error: "Only Landon can answer these notifications"
            });
        }

        if (answer !== "Yes" && answer !== "No") {
            return res.status(400).json({
                error: "Answer must be Yes or No"
            });
        }

        if (answer === "Yes" && (!food || !String(food).trim())) {
            return res.status(400).json({
                error: "Please enter what you ate"
            });
        }

        const key = `notification:${notificationId}`;

        const notification = await redis.get(key);

        if (!notification) {
            return res.status(404).json({
                error: "Notification not found"
            });
        }

        const answeredAt = new Date().toISOString();

        notification.answer = answer;
        notification.answeredAt = answeredAt;
        notification.answeredBy = "landon";

        if (answer === "Yes") {
            notification.food = String(food).trim();
        } else {
            notification.food = null;
        }

        await redis.set(key, notification);

        const history =
            await redis.lrange(
                "notifications",
                0,
                99
            );

        for (let i = 0; i < history.length; i++) {

            let item = history[i];

            if (typeof item === "string") {
                try {
                    item = JSON.parse(item);
                } catch {
                    continue;
                }
            }

            if (item.id === notificationId) {

                item.answer = answer;
                item.answeredAt = answeredAt;
                item.answeredBy = "landon";

                if (answer === "Yes") {
                    item.food = String(food).trim();
                } else {
                    item.food = null;
                }

                await redis.lset(
                    "notifications",
                    i,
                    JSON.stringify(item)
                );

                break;
            }
        }

        return res.status(200).json({
            success: true,
            notificationId,
            answer,
            food: answer === "Yes"
                ? String(food).trim()
                : null,
            answeredAt
        });

    } catch (error) {

        console.error(
            "Answer error:",
            error
        );

        return res.status(500).json({
            error: "Failed to save answer"
        });
    }
};
