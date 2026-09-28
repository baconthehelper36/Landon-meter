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

        // Mama is the person who answers the food question
        if (username !== "mama") {
            return res.status(403).json({
                error: "Only Mama can answer these notifications"
            });
        }

        if (answer !== "Yes" && answer !== "No") {
            return res.status(400).json({
                error: "Answer must be Yes or No"
            });
        }

        if (
            answer === "Yes" &&
            (!food || !String(food).trim())
        ) {
            return res.status(400).json({
                error: "Please enter what Landon ate"
            });
        }

        const notifications = await redis.lrange(
            "notifications",
            0,
            99
        );

        let found = false;
        let originalNotification = null;

        for (let i = 0; i < notifications.length; i++) {

            let notification = notifications[i];

            if (typeof notification === "string") {
                try {
                    notification = JSON.parse(notification);
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

            if (
                notification.type !==
                "food"
            ) {
                return res.status(400).json({
                    error:
                        "This notification cannot be answered"
                });
            }

            if (
                notification.recipient !==
                "mama"
            ) {
                return res.status(403).json({
                    error:
                        "This food notification is not assigned to Mama"
                });
            }

            if (notification.answer) {
                return res.status(400).json({
                    error:
                        "This notification has already been answered"
                });
            }

            const answeredAt =
                new Date().toISOString();

            const cleanedFood =
                answer === "Yes"
                    ? String(food).trim()
                    : null;

            notification.answer =
                answer;

            notification.food =
                cleanedFood;

            notification.answeredAt =
                answeredAt;

            notification.answeredBy =
                "mama";

            // Save Mama's answered notification
            await redis.lset(
                "notifications",
                i,
                JSON.stringify(notification)
            );

            await redis.set(
                `notification:${notificationId}`,
                notification
            );

            originalNotification =
                notification;

            found = true;

            break;
        }

        if (!found) {
            return res.status(404).json({
                error:
                    "Notification not found"
            });
        }

        /*
         * Create a NEW notification for Landon.
         *
         * Mama answers first.
         * Then Landon receives the result.
         */

        const meal =
            originalNotification.meal ||
            getMealFromNotification(
                originalNotification
            );

        const landonNotificationId =
            `${notificationId}-result`;

        const existingLandonNotification =
            await redis.get(
                `notification:${landonNotificationId}`
            );

        if (!existingLandonNotification) {

            let landonTitle;
            let landonBody;

            if (answer === "Yes") {

                landonTitle =
                    `Mama says you ate ${capitalizeMeal(meal)}`;

                landonBody =
                    `Mama answered Yes. You ate: ${cleanedFood}`;

            } else {

                landonTitle =
                    `Mama says you did not eat ${capitalizeMeal(meal)} yet`;

                landonBody =
                    "Mama answered No. You did not eat yet.";

            }

            const landonNotification = {

                id:
                    landonNotificationId,

                type:
                    "foodResult",

                recipient:
                    "landon",

                meal:
                    meal,

                title:
                    landonTitle,

                body:
                    landonBody,

                answer:
                    answer,

                food:
                    cleanedFood,

                answeredBy:
                    "mama",

                sourceNotificationId:
                    notificationId,

                createdAt:
                    new Date().toISOString()

            };

            await redis.lpush(
                "notifications",
                JSON.stringify(
                    landonNotification
                )
            );

            await redis.set(
                `notification:${landonNotificationId}`,
                landonNotification
            );
        }

        return res.status(200).json({

            success:
                true,

            notificationId:
                notificationId,

            answer:
                answer,

            food:
                cleanedFood,

            answeredAt:
                originalNotification.answeredAt,

            landonNotificationCreated:
                true

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


/*
 * Get the meal name.
 *
 * New notifications should have a "meal"
 * property, but this fallback keeps older
 * notifications working too.
 */

function getMealFromNotification(
    notification
) {

    const text =
        (
            notification.title ||
            notification.body ||
            ""
        ).toLowerCase();

    if (
        text.includes("breakfast")
    ) {
        return "breakfast";
    }

    if (
        text.includes("lunch")
    ) {
        return "lunch";
    }

    if (
        text.includes("dinner")
    ) {
        return "dinner";
    }

    return "meal";
}


function capitalizeMeal(
    meal
) {

    if (!meal) {
        return "Meal";
    }

    return (
        meal.charAt(0).toUpperCase() +
        meal.slice(1)
    );

}
